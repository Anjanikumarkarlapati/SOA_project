package com.agritech.irrigation;

import com.agritech.common.ApiException;
import com.agritech.common.CallerContext;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Positive;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/** FR-8: valve control and manual override. */
@RestController
@RequestMapping("/api/valves")
public class ValveController {

    private final ValveRepository valves;
    private final ValveService valveService;

    public ValveController(ValveRepository valves, ValveService valveService) {
        this.valves = valves;
        this.valveService = valveService;
    }

    /** Load a valve and check the caller is allowed to touch it (404 for another farm's zone). */
    private Valve require(String valveId, HttpServletRequest http) {
        Valve valve = valves.findById(valveId)
                .orElseThrow(() -> ApiException.notFound("Valve", valveId));
        CallerContext.requireAccess(http, valve.getFarmId(), "Valve", valveId);
        return valve;
    }

    /** Zones this caller may see: all of them for an administrator or a peer service. */
    private List<Valve> visibleTo(HttpServletRequest http) {
        String scope = CallerContext.scopeListFilter(http, null);
        return scope == null ? valves.findAll() : valves.findByFarmId(scope);
    }

    private static Map<String, Object> view(Valve v) {
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("valveId", v.getValveId());
        out.put("farmId", v.getFarmId());
        out.put("cropId", v.getCropId());
        out.put("zoneName", v.getZoneName());
        out.put("state", v.getState());
        out.put("flowRateLpm", v.isOpen() ? v.getFlowRateLpm() : 0.0);
        out.put("ratedFlowLpm", v.getFlowRateLpm());
        out.put("lastChangedAt", v.getLastChangedAt().toString());
        out.put("openUntil", v.getOpenUntil() == null ? null : v.getOpenUntil().toString());
        out.put("secondsRemaining", v.secondsRemaining());
        out.put("runningScheduleId", v.getRunningScheduleId());
        return out;
    }

    public record RegisterValveRequest(@NotBlank String valveId, @NotBlank String farmId,
                                       String cropId, @NotBlank String zoneName,
                                       @Positive double flowRateLpm) {}

    public record UpdateValveRequest(String cropId, String zoneName, Double flowRateLpm) {}

    /** Create: fit a new irrigation zone to a farm. Administrators and peer services only. */
    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public Map<String, Object> create(@Valid @RequestBody RegisterValveRequest req, HttpServletRequest http) {
        CallerContext.requireAdmin(http);
        if (valves.existsById(req.valveId())) {
            throw new ApiException(HttpStatus.CONFLICT, "valve_exists",
                    "Valve '" + req.valveId() + "' is already registered");
        }
        Valve valve = valves.save(new Valve(req.valveId(), req.farmId(), req.cropId(),
                req.zoneName(), req.flowRateLpm()));
        return view(valve);
    }

    @GetMapping
    public List<Map<String, Object>> list(HttpServletRequest http) {
        return visibleTo(http).stream()
                .sorted(Comparator.comparing(Valve::getValveId))
                .map(ValveController::view)
                .toList();
    }

    @GetMapping("/{valveId}/status")
    public Map<String, Object> status(@PathVariable String valveId, HttpServletRequest http) {
        return view(require(valveId, http));
    }

    /** Update: re-point a zone at another field, rename it, or correct its rated flow. */
    @PutMapping("/{valveId}")
    public Map<String, Object> update(@PathVariable String valveId,
                                      @Valid @RequestBody UpdateValveRequest req, HttpServletRequest http) {
        CallerContext.requireAdmin(http);
        Valve valve = require(valveId, http);
        valve.reconfigure(req.cropId(), req.zoneName(), req.flowRateLpm());
        return view(valves.save(valve));
    }

    /** Delete: decommission a zone. Refused while it is still running water. */
    @DeleteMapping("/{valveId}")
    public Map<String, String> delete(@PathVariable String valveId, HttpServletRequest http) {
        CallerContext.requireAdmin(http);
        Valve valve = require(valveId, http);
        if (valve.isOpen()) {
            throw new ApiException(HttpStatus.CONFLICT, "valve_open",
                    "Close valve '" + valveId + "' before removing it");
        }
        valves.delete(valve);
        return Map.of("status", "deleted", "valveId", valveId);
    }

    @PostMapping("/{valveId}/open")
    public Map<String, Object> open(@PathVariable String valveId,
                                    @RequestParam(defaultValue = "15") int durationMinutes,
                                    HttpServletRequest http) {
        CallerContext.requireAdmin(http);
        if (durationMinutes < 1 || durationMinutes > 240) {
            throw ApiException.badRequest("durationMinutes must be between 1 and 240");
        }
        Valve valve = require(valveId, http);
        String refusal = valveService.open(valve, durationMinutes, null, CallerContext.email(http));
        if (refusal != null) {
            throw new ApiException(HttpStatus.CONFLICT, "irrigation_blocked", refusal);
        }
        return view(valve);
    }

    @PostMapping("/{valveId}/close")
    public Map<String, Object> close(@PathVariable String valveId, HttpServletRequest http) {
        CallerContext.requireAdmin(http);
        Valve valve = require(valveId, http);
        valveService.close(valve, "manual override", CallerContext.email(http));
        return view(valve);
    }

    /**
     * FR-8 emergency stop. An administrator stops every farm; a farmer stops their own, which is
     * what the field app needs and used to require an admin session.
     */
    @PostMapping("/emergency-stop")
    public Map<String, Object> emergencyStop(@RequestParam(defaultValue = "manual emergency stop") String reason,
                                             HttpServletRequest http) {
        int closed;
        if (CallerContext.isPrivileged(http)) {
            closed = valveService.closeAll(reason, CallerContext.email(http));
        } else {
            // A farmer stops their own zones: no admin session needed for a safety stop on your
            // own land, and visibleTo() keeps it inside the caller's farm.
            closed = 0;
            for (Valve valve : visibleTo(http)) {
                if (valve.isOpen()) {
                    valveService.close(valve, reason, CallerContext.email(http));
                    closed++;
                }
            }
        }
        return Map.of("closed", closed, "reason", reason);
    }

    /** Dashboard stat tile: zones currently running, for the caller's own farms. */
    @GetMapping("/summary")
    public Map<String, Object> summary(HttpServletRequest http) {
        List<Valve> all = visibleTo(http);
        long open = all.stream().filter(Valve::isOpen).count();
        return Map.of("totalZones", all.size(), "running", open);
    }
}

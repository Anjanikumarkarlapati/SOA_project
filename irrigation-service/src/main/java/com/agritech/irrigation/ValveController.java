package com.agritech.irrigation;

import com.agritech.common.ApiException;
import com.agritech.common.CallerContext;
import jakarta.servlet.http.HttpServletRequest;
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

    private Valve require(String valveId) {
        return valves.findById(valveId).orElseThrow(() -> ApiException.notFound("Valve", valveId));
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

    @GetMapping
    public List<Map<String, Object>> list() {
        return valves.findAll().stream()
                .sorted(Comparator.comparing(Valve::getValveId))
                .map(ValveController::view)
                .toList();
    }

    @GetMapping("/{valveId}/status")
    public Map<String, Object> status(@PathVariable String valveId) {
        return view(require(valveId));
    }

    @PostMapping("/{valveId}/open")
    public Map<String, Object> open(@PathVariable String valveId,
                                    @RequestParam(defaultValue = "15") int durationMinutes,
                                    HttpServletRequest http) {
        CallerContext.requireAdmin(http);
        if (durationMinutes < 1 || durationMinutes > 240) {
            throw ApiException.badRequest("durationMinutes must be between 1 and 240");
        }
        Valve valve = require(valveId);
        String refusal = valveService.open(valve, durationMinutes, null, CallerContext.email(http));
        if (refusal != null) {
            throw new ApiException(HttpStatus.CONFLICT, "irrigation_blocked", refusal);
        }
        return view(valve);
    }

    @PostMapping("/{valveId}/close")
    public Map<String, Object> close(@PathVariable String valveId, HttpServletRequest http) {
        CallerContext.requireAdmin(http);
        Valve valve = require(valveId);
        valveService.close(valve, "manual override", CallerContext.email(http));
        return view(valve);
    }

    /** FR-8 emergency stop - farm-wide, so the UI confirms before calling it. */
    @PostMapping("/emergency-stop")
    public Map<String, Object> emergencyStop(@RequestParam(defaultValue = "manual emergency stop") String reason,
                                             HttpServletRequest http) {
        CallerContext.requireAdmin(http);
        int closed = valveService.closeAll(reason, CallerContext.email(http));
        return Map.of("closed", closed, "reason", reason);
    }

    /** Dashboard stat tile: zones currently running. */
    @GetMapping("/summary")
    public Map<String, Object> summary() {
        List<Valve> all = valves.findAll();
        long open = all.stream().filter(Valve::isOpen).count();
        return Map.of("totalZones", all.size(), "running", open);
    }
}

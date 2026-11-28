package com.agritech.irrigation;

import com.agritech.common.ApiException;
import com.agritech.common.CallerContext;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.time.DayOfWeek;
import java.time.LocalTime;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

/** FR-7: irrigation scheduling. */
@RestController
@RequestMapping("/api/irrigation")
public class IrrigationController {

    private static final Logger audit = LoggerFactory.getLogger("AUDIT");

    private final ScheduleRepository schedules;
    private final ValveRepository valves;
    private final EventRepository events;

    public IrrigationController(ScheduleRepository schedules, ValveRepository valves, EventRepository events) {
        this.schedules = schedules;
        this.valves = valves;
        this.events = events;
    }

    public record ScheduleRequest(
            @NotBlank String cropId,
            @NotBlank String valveId,
            String farmId,
            String recurrence,
            List<String> daysOfWeek,
            @NotBlank String startTime,
            @Min(value = 1, message = "must be at least 1 minute")
            @Max(value = 240, message = "must be at most 240 minutes") int durationMinutes,
            Boolean skipIfMoist,
            Boolean active) {}

    public record ScheduleView(String scheduleId, String farmId, String cropId, String valveId,
                               String zoneName, String recurrence, List<String> daysOfWeek,
                               String startTime, int durationMinutes, boolean active,
                               boolean skipIfMoist, String lastRunAt) {}

    private ScheduleView view(IrrigationSchedule s) {
        String zoneName = valves.findById(s.getValveId()).map(Valve::getZoneName).orElse(s.getValveId());
        return new ScheduleView(s.getScheduleId(), s.getFarmId(), s.getCropId(), s.getValveId(), zoneName,
                s.getRecurrence(), s.dayNames(), s.getStartTime().toString(), s.getDurationMinutes(),
                s.isActive(), s.isSkipIfMoist(),
                s.getLastRunAt() == null ? null : s.getLastRunAt().toString());
    }

    /** Load a schedule and check the caller may see it (404 for another farm's plan). */
    private IrrigationSchedule require(String scheduleId, HttpServletRequest http) {
        IrrigationSchedule schedule = schedules.findById(scheduleId)
                .orElseThrow(() -> ApiException.notFound("Schedule", scheduleId));
        CallerContext.requireAccess(http, schedule.getFarmId(), "Schedule", scheduleId);
        return schedule;
    }

    /** Schedules this caller may see: all of them for an administrator or a peer service. */
    private List<IrrigationSchedule> visibleTo(HttpServletRequest http) {
        String scope = CallerContext.scopeListFilter(http, null);
        return scope == null ? schedules.findAll() : schedules.findByFarmId(scope);
    }

    @GetMapping("/schedules")
    public List<ScheduleView> list(HttpServletRequest http) {
        return visibleTo(http).stream()
                .map(this::view)
                .sorted(Comparator.comparing(ScheduleView::startTime))
                .toList();
    }

    @GetMapping("/schedules/{scheduleId}")
    public ScheduleView get(@PathVariable String scheduleId, HttpServletRequest http) {
        return view(require(scheduleId, http));
    }

    /** The valve a schedule may drive: it must exist, be visible, and be on the same farm. */
    private void requireValve(String valveId, String farmId, HttpServletRequest http) {
        Valve valve = valves.findById(valveId)
                .orElseThrow(() -> ApiException.notFound("Valve", valveId));
        CallerContext.requireAccess(http, valve.getFarmId(), "Valve", valveId);
        if (farmId != null && !farmId.equals(valve.getFarmId())) {
            throw ApiException.badRequest("Valve '" + valveId + "' belongs to farm "
                    + valve.getFarmId() + ", not " + farmId);
        }
    }

    @PostMapping("/schedules")
    @ResponseStatus(HttpStatus.CREATED)
    public ScheduleView create(@Valid @RequestBody ScheduleRequest req, HttpServletRequest http) {
        CallerContext.requireAdmin(http);
        // A farmer can never place a schedule on another farm, whatever farmId they send.
        String farmId = CallerContext.isPrivileged(http) && req.farmId() != null
                ? req.farmId() : CallerContext.farmScope(http);
        requireValve(req.valveId(), farmId, http);

        String recurrence = req.recurrence() == null ? "DAILY" : req.recurrence().toUpperCase();
        if (!recurrence.equals("DAILY") && !recurrence.equals("WEEKLY")) {
            throw ApiException.badRequest("recurrence must be DAILY or WEEKLY");
        }
        String days = req.daysOfWeek() == null ? null : parseDays(req.daysOfWeek());
        if (recurrence.equals("WEEKLY") && (days == null || days.isBlank())) {
            throw ApiException.badRequest("a WEEKLY schedule needs at least one day in daysOfWeek");
        }

        IrrigationSchedule schedule = new IrrigationSchedule(
                "SCHEDULE-" + UUID.randomUUID().toString().substring(0, 8).toUpperCase(),
                farmId, req.cropId(), req.valveId(), recurrence, days, parseTime(req.startTime()),
                req.durationMinutes(), req.skipIfMoist() == null || req.skipIfMoist());
        schedule.setActive(req.active() == null || req.active());
        audit.info("schedule.create by={} valve={} at={}", CallerContext.email(http),
                req.valveId(), req.startTime());
        return view(schedules.save(schedule));
    }

    @PutMapping("/schedules/{scheduleId}")
    public ScheduleView update(@PathVariable String scheduleId, @RequestBody ScheduleRequest req,
                               HttpServletRequest http) {
        CallerContext.requireAdmin(http);
        IrrigationSchedule schedule = require(scheduleId, http);

        if (req.cropId() != null) schedule.setCropId(req.cropId());
        if (req.valveId() != null) {
            requireValve(req.valveId(), schedule.getFarmId(), http);
            schedule.setValveId(req.valveId());
        }
        if (req.recurrence() != null) {
            String rec = req.recurrence().toUpperCase();
            if (!rec.equals("DAILY") && !rec.equals("WEEKLY")) {
                throw ApiException.badRequest("recurrence must be DAILY or WEEKLY");
            }
            schedule.setRecurrence(rec);
        }
        if (req.daysOfWeek() != null) schedule.setDaysOfWeek(parseDays(req.daysOfWeek()));
        if ("WEEKLY".equals(schedule.getRecurrence())
                && (schedule.getDaysOfWeek() == null || schedule.getDaysOfWeek().isBlank())) {
            throw ApiException.badRequest("a WEEKLY schedule needs at least one day in daysOfWeek");
        }
        if (req.startTime() != null) schedule.setStartTime(parseTime(req.startTime()));
        if (req.durationMinutes() < 0 || req.durationMinutes() > 240) {
            throw ApiException.badRequest("durationMinutes must be between 1 and 240");
        }
        if (req.durationMinutes() > 0) schedule.setDurationMinutes(req.durationMinutes());
        if (req.skipIfMoist() != null) schedule.setSkipIfMoist(req.skipIfMoist());
        if (req.active() != null) schedule.setActive(req.active());

        audit.info("schedule.update by={} schedule={}", CallerContext.email(http), scheduleId);
        return view(schedules.save(schedule));
    }

    /** The list's on/off toggle, separate from a full edit. */
    @PatchMapping("/schedules/{scheduleId}/active")
    public ScheduleView toggle(@PathVariable String scheduleId, @RequestBody Map<String, Boolean> body,
                               HttpServletRequest http) {
        CallerContext.requireAdmin(http);
        IrrigationSchedule schedule = require(scheduleId, http);
        schedule.setActive(Boolean.TRUE.equals(body.get("active")));
        audit.info("schedule.toggle by={} schedule={} active={}",
                CallerContext.email(http), scheduleId, schedule.isActive());
        return view(schedules.save(schedule));
    }

    @DeleteMapping("/schedules/{scheduleId}")
    public Map<String, String> delete(@PathVariable String scheduleId, HttpServletRequest http) {
        CallerContext.requireAdmin(http);
        schedules.delete(require(scheduleId, http));
        audit.info("schedule.delete by={} schedule={}", CallerContext.email(http), scheduleId);
        return Map.of("status", "deleted", "scheduleId", scheduleId);
    }

    /**
     * Irrigation activity for the dashboard alert feed. An event carries a valveId, not a farmId,
     * so the feed is filtered through the valves the caller is allowed to see; a farmer never sees
     * another farm's activity.
     */
    @GetMapping("/events")
    public List<Map<String, Object>> recentEvents(HttpServletRequest http) {
        List<Map<String, Object>> feed = new ArrayList<>();
        if (CallerContext.isPrivileged(http)) {
            events.findTop50ByOrderByTimestampDesc().forEach(e -> feed.add(eventView(e)));
            return feed;
        }
        String farm = CallerContext.farmScope(http);
        if (farm == null) return feed; // no tenant on this token: nothing to show
        Set<String> mine = new HashSet<>();
        schedules.findByFarmId(farm).forEach(s -> mine.add(s.getValveId()));
        valves.findByFarmId(farm).forEach(v -> mine.add(v.getValveId()));
        // Over-fetch, then trim: most of the platform's events belong to other farms.
        events.findTop500ByOrderByTimestampDesc().stream()
                .filter(e -> mine.contains(e.getValveId()))
                .limit(50)
                .forEach(e -> feed.add(eventView(e)));
        return feed;
    }

    private static Map<String, Object> eventView(IrrigationEvent e) {
        return Map.<String, Object>of(
                "id", "irrigation-" + e.getId(),
                "severity", e.getSeverity(),
                "source", e.getValveId(),
                "cropId", e.getCropId() == null ? "" : e.getCropId(),
                "message", e.getMessage(),
                "timestamp", e.getTimestamp().toString());
    }

    /** Rejects bad day names up front; a stored bad name would break every read of the schedule. */
    private static String parseDays(List<String> values) {
        try {
            return String.join(",", values.stream()
                    .map(d -> DayOfWeek.valueOf(d.trim().toUpperCase()).name()).toList());
        } catch (IllegalArgumentException | NullPointerException e) {
            throw ApiException.badRequest("daysOfWeek must be full day names, e.g. MONDAY, THURSDAY");
        }
    }

    private static LocalTime parseTime(String value) {
        try {
            return LocalTime.parse(value.length() == 5 ? value + ":00" : value);
        } catch (DateTimeParseException e) {
            throw ApiException.badRequest("startTime must be HH:mm or HH:mm:ss");
        }
    }
}

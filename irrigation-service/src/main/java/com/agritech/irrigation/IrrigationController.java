package com.agritech.irrigation;

import com.agritech.common.ApiException;
import com.agritech.common.CallerContext;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.time.LocalTime;
import java.time.format.DateTimeParseException;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
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
            @Min(value = 1, message = "must be at least 1 minute") int durationMinutes,
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

    private IrrigationSchedule require(String scheduleId) {
        return schedules.findById(scheduleId)
                .orElseThrow(() -> ApiException.notFound("Schedule", scheduleId));
    }

    @GetMapping("/schedules")
    public List<ScheduleView> list() {
        return schedules.findAll().stream()
                .map(this::view)
                .sorted(Comparator.comparing(ScheduleView::startTime))
                .toList();
    }

    @GetMapping("/schedules/{scheduleId}")
    public ScheduleView get(@PathVariable String scheduleId) {
        return view(require(scheduleId));
    }

    @PostMapping("/schedules")
    @ResponseStatus(HttpStatus.CREATED)
    public ScheduleView create(@Valid @RequestBody ScheduleRequest req, HttpServletRequest http) {
        CallerContext.requireAdmin(http);
        if (!valves.existsById(req.valveId())) throw ApiException.notFound("Valve", req.valveId());

        String recurrence = req.recurrence() == null ? "DAILY" : req.recurrence().toUpperCase();
        if (!recurrence.equals("DAILY") && !recurrence.equals("WEEKLY")) {
            throw ApiException.badRequest("recurrence must be DAILY or WEEKLY");
        }
        String days = req.daysOfWeek() == null ? null : String.join(",", req.daysOfWeek());
        if (recurrence.equals("WEEKLY") && (days == null || days.isBlank())) {
            throw ApiException.badRequest("a WEEKLY schedule needs at least one day in daysOfWeek");
        }

        IrrigationSchedule schedule = new IrrigationSchedule(
                "SCHEDULE-" + UUID.randomUUID().toString().substring(0, 8).toUpperCase(),
                req.farmId() == null ? CallerContext.farmId(http) : req.farmId(),
                req.cropId(), req.valveId(), recurrence, days, parseTime(req.startTime()),
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
        IrrigationSchedule schedule = require(scheduleId);

        if (req.cropId() != null) schedule.setCropId(req.cropId());
        if (req.valveId() != null) {
            if (!valves.existsById(req.valveId())) throw ApiException.notFound("Valve", req.valveId());
            schedule.setValveId(req.valveId());
        }
        if (req.recurrence() != null) schedule.setRecurrence(req.recurrence().toUpperCase());
        if (req.daysOfWeek() != null) schedule.setDaysOfWeek(String.join(",", req.daysOfWeek()));
        if (req.startTime() != null) schedule.setStartTime(parseTime(req.startTime()));
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
        IrrigationSchedule schedule = require(scheduleId);
        schedule.setActive(Boolean.TRUE.equals(body.get("active")));
        audit.info("schedule.toggle by={} schedule={} active={}",
                CallerContext.email(http), scheduleId, schedule.isActive());
        return view(schedules.save(schedule));
    }

    @DeleteMapping("/schedules/{scheduleId}")
    public Map<String, String> delete(@PathVariable String scheduleId, HttpServletRequest http) {
        CallerContext.requireAdmin(http);
        schedules.delete(require(scheduleId));
        audit.info("schedule.delete by={} schedule={}", CallerContext.email(http), scheduleId);
        return Map.of("status", "deleted", "scheduleId", scheduleId);
    }

    /** Irrigation activity for the dashboard alert feed. */
    @GetMapping("/events")
    public List<Map<String, Object>> recentEvents() {
        return events.findTop50ByOrderByTimestampDesc().stream()
                .map(e -> Map.<String, Object>of(
                        "id", "irrigation-" + e.getId(),
                        "severity", e.getSeverity(),
                        "source", e.getValveId(),
                        "cropId", e.getCropId() == null ? "" : e.getCropId(),
                        "message", e.getMessage(),
                        "timestamp", e.getTimestamp().toString()))
                .toList();
    }

    private static LocalTime parseTime(String value) {
        try {
            return LocalTime.parse(value.length() == 5 ? value + ":00" : value);
        } catch (DateTimeParseException e) {
            throw ApiException.badRequest("startTime must be HH:mm or HH:mm:ss");
        }
    }
}

package com.agritech.irrigation;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.DayOfWeek;
import java.time.Instant;
import java.time.LocalTime;
import java.util.Arrays;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

/** FR-7: a recurring watering window for one zone. */
@Entity
@Table(name = "irrigation_schedules")
public class IrrigationSchedule {

    @Id
    private String scheduleId;

    @Column(nullable = false)
    private String farmId;

    @Column(nullable = false)
    private String cropId;

    @Column(nullable = false)
    private String valveId;

    /** DAILY or WEEKLY. WEEKLY honours daysOfWeek. */
    @Column(nullable = false)
    private String recurrence = "DAILY";

    /** Comma-separated day names for WEEKLY, e.g. "MONDAY,THURSDAY". */
    private String daysOfWeek;

    @Column(nullable = false)
    private LocalTime startTime;

    @Column(nullable = false)
    private int durationMinutes;

    @Column(nullable = false)
    private boolean active = true;

    /**
     * When true the scheduler skips the run if the crop's health says the soil is already wet
     * enough - this is where the water saving actually comes from.
     */
    @Column(nullable = false)
    private boolean skipIfMoist = true;

    private Instant lastRunAt;

    protected IrrigationSchedule() {}

    public IrrigationSchedule(String scheduleId, String farmId, String cropId, String valveId,
                              String recurrence, String daysOfWeek, LocalTime startTime,
                              int durationMinutes, boolean skipIfMoist) {
        this.scheduleId = scheduleId;
        this.farmId = farmId;
        this.cropId = cropId;
        this.valveId = valveId;
        this.recurrence = recurrence;
        this.daysOfWeek = daysOfWeek;
        this.startTime = startTime;
        this.durationMinutes = durationMinutes;
        this.skipIfMoist = skipIfMoist;
    }

    public Set<DayOfWeek> days() {
        if (daysOfWeek == null || daysOfWeek.isBlank()) return Set.of();
        return Arrays.stream(daysOfWeek.split(","))
                .map(String::trim)
                .filter(s -> !s.isEmpty())
                .map(String::toUpperCase)
                .map(DayOfWeek::valueOf)
                .collect(Collectors.toSet());
    }

    public List<String> dayNames() {
        return days().stream().map(Enum::name).sorted().toList();
    }

    public String getScheduleId() { return scheduleId; }
    public String getFarmId() { return farmId; }
    public String getCropId() { return cropId; }
    public void setCropId(String cropId) { this.cropId = cropId; }
    public String getValveId() { return valveId; }
    public void setValveId(String valveId) { this.valveId = valveId; }
    public String getRecurrence() { return recurrence; }
    public void setRecurrence(String recurrence) { this.recurrence = recurrence; }
    public String getDaysOfWeek() { return daysOfWeek; }
    public void setDaysOfWeek(String daysOfWeek) { this.daysOfWeek = daysOfWeek; }
    public LocalTime getStartTime() { return startTime; }
    public void setStartTime(LocalTime startTime) { this.startTime = startTime; }
    public int getDurationMinutes() { return durationMinutes; }
    public void setDurationMinutes(int durationMinutes) { this.durationMinutes = durationMinutes; }
    public boolean isActive() { return active; }
    public void setActive(boolean active) { this.active = active; }
    public boolean isSkipIfMoist() { return skipIfMoist; }
    public void setSkipIfMoist(boolean skipIfMoist) { this.skipIfMoist = skipIfMoist; }
    public Instant getLastRunAt() { return lastRunAt; }
    public void setLastRunAt(Instant lastRunAt) { this.lastRunAt = lastRunAt; }
}

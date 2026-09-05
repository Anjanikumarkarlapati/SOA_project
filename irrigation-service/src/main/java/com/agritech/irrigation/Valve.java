package com.agritech.irrigation;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.Instant;

/** One irrigation zone's valve (FR-8). */
@Entity
@Table(name = "valves")
public class Valve {

    @Id
    private String valveId;

    @Column(nullable = false)
    private String farmId;

    /** Field this valve waters; the crop service knows it by the same id. */
    @Column(nullable = false)
    private String cropId;

    @Column(nullable = false)
    private String zoneName;

    /** OPEN or CLOSED. */
    @Column(nullable = false)
    private String state = "CLOSED";

    private double flowRateLpm;
    private Instant lastChangedAt = Instant.now();

    /** When an open run should automatically close. Null means "held open until told otherwise". */
    private Instant openUntil;

    /** Schedule that opened it, if any - manual runs leave this null. */
    private String runningScheduleId;

    protected Valve() {}

    public Valve(String valveId, String farmId, String cropId, String zoneName, double flowRateLpm) {
        this.valveId = valveId;
        this.farmId = farmId;
        this.cropId = cropId;
        this.zoneName = zoneName;
        this.flowRateLpm = flowRateLpm;
    }

    public void open(Instant until, String scheduleId) {
        this.state = "OPEN";
        this.openUntil = until;
        this.runningScheduleId = scheduleId;
        this.lastChangedAt = Instant.now();
    }

    public void close() {
        this.state = "CLOSED";
        this.openUntil = null;
        this.runningScheduleId = null;
        this.lastChangedAt = Instant.now();
    }

    public boolean isOpen() { return "OPEN".equals(state); }

    /** Seconds left in the current run, or null when not running to a deadline. */
    public Long secondsRemaining() {
        if (!isOpen() || openUntil == null) return null;
        return Math.max(0, openUntil.getEpochSecond() - Instant.now().getEpochSecond());
    }

    public String getValveId() { return valveId; }
    public String getFarmId() { return farmId; }
    public String getCropId() { return cropId; }
    public String getZoneName() { return zoneName; }
    public String getState() { return state; }
    public double getFlowRateLpm() { return flowRateLpm; }
    public Instant getLastChangedAt() { return lastChangedAt; }
    public Instant getOpenUntil() { return openUntil; }
    public String getRunningScheduleId() { return runningScheduleId; }
}

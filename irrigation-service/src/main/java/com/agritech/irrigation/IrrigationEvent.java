package com.agritech.irrigation;

import jakarta.persistence.*;

import java.time.Instant;

/** Audit trail of what the valves actually did - feeds the dashboard alert list. */
@Entity
@Table(name = "irrigation_events")
public class IrrigationEvent {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private Instant timestamp = Instant.now();

    /** INFO, WARNING or CRITICAL - matches the dashboard's severity encoding. */
    @Column(nullable = false)
    private String severity;

    @Column(nullable = false)
    private String valveId;

    private String cropId;

    @Column(nullable = false, length = 500)
    private String message;

    protected IrrigationEvent() {}

    public IrrigationEvent(String severity, String valveId, String cropId, String message) {
        this.severity = severity;
        this.valveId = valveId;
        this.cropId = cropId;
        this.message = message;
    }

    public Long getId() { return id; }
    public Instant getTimestamp() { return timestamp; }
    public String getSeverity() { return severity; }
    public String getValveId() { return valveId; }
    public String getCropId() { return cropId; }
    public String getMessage() { return message; }
}

package com.agritech.sensor;

import jakarta.persistence.*;

import java.time.Instant;

@Entity
@Table(name = "telemetry_readings", indexes = @Index(name = "idx_device_time", columnList = "deviceId,timestamp"))
public class TelemetryReading {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String deviceId;

    @Column(nullable = false)
    private Instant timestamp;

    private double soilMoisture;
    private double soilTemperature;
    private double ph;
    private Double batteryPercent;

    protected TelemetryReading() {}

    public TelemetryReading(String deviceId, Instant timestamp, double soilMoisture,
                            double soilTemperature, double ph, Double batteryPercent) {
        this.deviceId = deviceId;
        this.timestamp = timestamp;
        this.soilMoisture = soilMoisture;
        this.soilTemperature = soilTemperature;
        this.ph = ph;
        this.batteryPercent = batteryPercent;
    }

    public Long getId() { return id; }
    public String getDeviceId() { return deviceId; }
    public Instant getTimestamp() { return timestamp; }
    public double getSoilMoisture() { return soilMoisture; }
    public double getSoilTemperature() { return soilTemperature; }
    public double getPh() { return ph; }
    public Double getBatteryPercent() { return batteryPercent; }
}

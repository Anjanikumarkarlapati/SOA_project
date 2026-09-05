package com.agritech.sensor;

import jakarta.persistence.*;

import java.time.Duration;
import java.time.Instant;

@Entity
@Table(name = "sensor_devices")
public class SensorDevice {

    /** How long without a reading before a device is considered offline. */
    public static final Duration OFFLINE_AFTER = Duration.ofMinutes(15);
    public static final double LOW_BATTERY_PERCENT = 20;

    @Id
    private String deviceId;

    @Column(nullable = false)
    private String farmId;

    @Column(nullable = false)
    private String sensorType;

    /** Crop/field this device is assigned to, e.g. CROP-FIELD-01. Nullable until assigned. */
    private String fieldId;

    private double latitude;
    private double longitude;

    @Column(nullable = false)
    private Instant registered = Instant.now();

    /** ACTIVE or DECOMMISSIONED - an admin deregistering a device sets DECOMMISSIONED. */
    @Column(nullable = false)
    private String status = "ACTIVE";

    private Double batteryPercent;
    private Instant lastReadingAt;

    protected SensorDevice() {}

    public SensorDevice(String deviceId, String farmId, String sensorType, String fieldId,
                        double latitude, double longitude) {
        this.deviceId = deviceId;
        this.farmId = farmId;
        this.sensorType = sensorType;
        this.fieldId = fieldId;
        this.latitude = latitude;
        this.longitude = longitude;
    }

    /** ONLINE / OFFLINE / LOW_BATTERY / DECOMMISSIONED - what the sensor table renders. */
    public String health() {
        if ("DECOMMISSIONED".equals(status)) return "DECOMMISSIONED";
        if (lastReadingAt == null || lastReadingAt.isBefore(Instant.now().minus(OFFLINE_AFTER))) return "OFFLINE";
        if (batteryPercent != null && batteryPercent < LOW_BATTERY_PERCENT) return "LOW_BATTERY";
        return "ONLINE";
    }

    public void recordReading(Instant at, Double battery) {
        if (lastReadingAt == null || at.isAfter(lastReadingAt)) lastReadingAt = at;
        if (battery != null) batteryPercent = battery;
    }

    public String getDeviceId() { return deviceId; }
    public String getFarmId() { return farmId; }
    public void setFarmId(String farmId) { this.farmId = farmId; }
    public String getSensorType() { return sensorType; }
    public void setSensorType(String sensorType) { this.sensorType = sensorType; }
    public String getFieldId() { return fieldId; }
    public void setFieldId(String fieldId) { this.fieldId = fieldId; }
    public double getLatitude() { return latitude; }
    public void setLatitude(double latitude) { this.latitude = latitude; }
    public double getLongitude() { return longitude; }
    public void setLongitude(double longitude) { this.longitude = longitude; }
    public Instant getRegistered() { return registered; }
    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
    public Double getBatteryPercent() { return batteryPercent; }
    public void setBatteryPercent(Double batteryPercent) { this.batteryPercent = batteryPercent; }
    public Instant getLastReadingAt() { return lastReadingAt; }
}

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

    // Soil probe: every device reports these.
    private double soilMoisture;
    private double soilTemperature;
    private double ph;
    private Double batteryPercent;

    // Optional measurements, null when the device has no such sensor.
    private Double airTemperature;
    private Double humidity;
    private Double lightLux;
    /** Soil nitrogen, phosphorus and potassium, mg/kg. */
    private Double nitrogen;
    private Double phosphorus;
    private Double potassium;
    /** Rain since the previous reading, mm. */
    private Double rainfallMm;
    /** Standing water in a ponded (paddy) field, mm. */
    private Double waterLevelMm;

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

    /** Fills the optional measurements; pass null for any the device does not have. */
    public TelemetryReading environment(Double airTemperature, Double humidity, Double lightLux,
                                        Double nitrogen, Double phosphorus, Double potassium,
                                        Double rainfallMm, Double waterLevelMm) {
        this.airTemperature = airTemperature;
        this.humidity = humidity;
        this.lightLux = lightLux;
        this.nitrogen = nitrogen;
        this.phosphorus = phosphorus;
        this.potassium = potassium;
        this.rainfallMm = rainfallMm;
        this.waterLevelMm = waterLevelMm;
        return this;
    }

    public Long getId() { return id; }
    public String getDeviceId() { return deviceId; }
    public Instant getTimestamp() { return timestamp; }
    public double getSoilMoisture() { return soilMoisture; }
    public double getSoilTemperature() { return soilTemperature; }
    public double getPh() { return ph; }
    public Double getBatteryPercent() { return batteryPercent; }
    public Double getAirTemperature() { return airTemperature; }
    public Double getHumidity() { return humidity; }
    public Double getLightLux() { return lightLux; }
    public Double getNitrogen() { return nitrogen; }
    public Double getPhosphorus() { return phosphorus; }
    public Double getPotassium() { return potassium; }
    public Double getRainfallMm() { return rainfallMm; }
    public Double getWaterLevelMm() { return waterLevelMm; }
}

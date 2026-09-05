package com.agritech.crop;

import jakarta.persistence.*;

import java.time.Instant;
import java.util.Arrays;
import java.util.List;

/** One evaluation of a crop's environment, kept as history for the trend charts. */
@Entity
@Table(name = "health_snapshots", indexes = @Index(name = "idx_crop_time", columnList = "cropId,timestamp"))
public class HealthSnapshot {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String cropId;

    @Column(nullable = false)
    private Instant timestamp;

    private int healthScore;
    private String moistureStatus;
    private String temperatureStatus;
    private String phStatus;

    private Double soilMoisture;
    private Double soilTemperature;
    private Double ph;

    /** Hours until moisture is projected to fall below optimal; null when not trending down. */
    private Double hoursToIrrigation;

    @Column(length = 2000)
    private String recommendations;

    protected HealthSnapshot() {}

    public HealthSnapshot(String cropId, Instant timestamp, int healthScore, String moistureStatus,
                          String temperatureStatus, String phStatus, Double soilMoisture,
                          Double soilTemperature, Double ph, Double hoursToIrrigation,
                          List<String> recommendations) {
        this.cropId = cropId;
        this.timestamp = timestamp;
        this.healthScore = healthScore;
        this.moistureStatus = moistureStatus;
        this.temperatureStatus = temperatureStatus;
        this.phStatus = phStatus;
        this.soilMoisture = soilMoisture;
        this.soilTemperature = soilTemperature;
        this.ph = ph;
        this.hoursToIrrigation = hoursToIrrigation;
        this.recommendations = String.join("|", recommendations);
    }

    public Long getId() { return id; }
    public String getCropId() { return cropId; }
    public Instant getTimestamp() { return timestamp; }
    public int getHealthScore() { return healthScore; }
    public String getMoistureStatus() { return moistureStatus; }
    public String getTemperatureStatus() { return temperatureStatus; }
    public String getPhStatus() { return phStatus; }
    public Double getSoilMoisture() { return soilMoisture; }
    public Double getSoilTemperature() { return soilTemperature; }
    public Double getPh() { return ph; }
    public Double getHoursToIrrigation() { return hoursToIrrigation; }

    public List<String> getRecommendations() {
        if (recommendations == null || recommendations.isBlank()) return List.of();
        return Arrays.asList(recommendations.split("\\|"));
    }

    /** Worst of the three metric statuses - what the status dot renders. */
    public String overallStatus() {
        for (String s : List.of(moistureStatus, temperatureStatus, phStatus)) {
            if ("CRITICAL".equals(s)) return "CRITICAL";
        }
        for (String s : List.of(moistureStatus, temperatureStatus, phStatus)) {
            if ("WARNING".equals(s)) return "WARNING";
        }
        return "OPTIMAL";
    }
}

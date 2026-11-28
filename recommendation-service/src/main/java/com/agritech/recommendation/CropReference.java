package com.agritech.recommendation;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

/** Reference agronomy inputs used by the crop suitability scorer. */
@Entity
@Table(name = "crops")
public class CropReference {
    @Id
    @Column(name = "crop_id", length = 40)
    private String cropId;
    @Column(nullable = false, length = 120)
    private String name;
    @Column(name = "crop_group", nullable = false, length = 60)
    private String groupName;
    @Column(name = "temperature_min_c", nullable = false)
    private double temperatureMinC;
    @Column(name = "temperature_max_c", nullable = false)
    private double temperatureMaxC;
    @Column(name = "water_need_mm", nullable = false)
    private double waterNeedMm;
    @Column(name = "soil_preference", nullable = false, length = 80)
    private String soilPreference;
    @Column(name = "season_windows", nullable = false, length = 40)
    private String seasonWindows;
    @Column(name = "duration_days", nullable = false)
    private int durationDays;

    protected CropReference() {}

    CropReference(String cropId, String name, String groupName, double temperatureMinC, double temperatureMaxC,
                  double waterNeedMm, String soilPreference, String seasonWindows, int durationDays) {
        this.cropId = cropId;
        this.name = name;
        this.groupName = groupName;
        this.temperatureMinC = temperatureMinC;
        this.temperatureMaxC = temperatureMaxC;
        this.waterNeedMm = waterNeedMm;
        this.soilPreference = soilPreference;
        this.seasonWindows = seasonWindows;
        this.durationDays = durationDays;
    }

    static CropReference from(CropCatalog.Spec crop) {
        return new CropReference(crop.id(), crop.name(), crop.group(), crop.temperature().min(),
                crop.temperature().max(), waterNeed(crop.group()), soilPreference(crop.group()),
                seasonWindows(crop.id()), durationDays(crop.group(), crop.id()));
    }

    private static double waterNeed(String group) {
        return switch (group) {
            case "Millets" -> 350;
            case "Pulses" -> 450;
            case "Oilseeds" -> 500;
            case "Cereals" -> 650;
            case "Vegetables" -> 600;
            case "Cash crops", "Fruits" -> 1000;
            case "Spices" -> 850;
            case "Plantation" -> 1500;
            default -> 700;
        };
    }

    private static String soilPreference(String group) {
        return switch (group) {
            case "Millets", "Oilseeds" -> "Sandy or red loam";
            case "Cash crops" -> "Black or alluvial";
            case "Cereals", "Pulses" -> "Alluvial or black";
            case "Plantation", "Spices" -> "Red or laterite";
            case "Fruits" -> "Well-drained loam";
            default -> "Loam or alluvial";
        };
    }

    private static String seasonWindows(String id) {
        if (java.util.Set.of("rice", "maize", "jowar", "bajra", "ragi", "tur", "moong", "urad",
                "groundnut", "soybean", "cotton", "jute", "sugarcane", "okra", "brinjal", "chilli", "tomato").contains(id)) {
            return "KHARIF";
        }
        if (java.util.Set.of("grapes", "banana", "mango", "coconut", "arecanut", "cashew", "coffee", "tea").contains(id)) {
            return "PERENNIAL";
        }
        return "RABI";
    }

    private static int durationDays(String group, String id) {
        if ("sugarcane".equals(id)) return 330;
        if ("Fruits".equals(group) || "Plantation".equals(group)) return 240;
        if ("Cash crops".equals(group)) return 180;
        if ("Vegetables".equals(group)) return 100;
        return 120;
    }

    CropCatalog.Range temperatureRange() { return new CropCatalog.Range(temperatureMinC, temperatureMaxC); }
    public String getCropId() { return cropId; }
    public String getName() { return name; }
    public String getGroupName() { return groupName; }
    public double getTemperatureMinC() { return temperatureMinC; }
    public double getTemperatureMaxC() { return temperatureMaxC; }
    public double getWaterNeedMm() { return waterNeedMm; }
    public String getSoilPreference() { return soilPreference; }
    public String getSeasonWindows() { return seasonWindows; }
    public int getDurationDays() { return durationDays; }
}

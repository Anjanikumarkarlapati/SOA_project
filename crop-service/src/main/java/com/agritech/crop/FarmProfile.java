package com.agritech.crop;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.Instant;
import java.util.Arrays;
import java.util.List;

/**
 * A user's farm, captured by first-login onboarding. One per user, keyed by the gateway-verified
 * login email, so a user can only ever reach their own farm. The field it farms is a regular
 * {@link Crop} row (fieldId) watched by one sensor device (deviceId).
 */
@Entity
@Table(name = "farm_profiles")
public class FarmProfile {

    @Id
    private String ownerEmail;

    @Column(nullable = false, length = 80)
    private String farmName;

    private double landSize;

    /** ACRES or HECTARES, as the farmer entered it. */
    @Column(nullable = false, length = 10)
    private String landUnit;

    /** CropCatalog id, e.g. "rice". */
    @Column(nullable = false, length = 40)
    private String cropId;

    @Column(length = 60)
    private String state;

    @Column(length = 60)
    private String district;

    /** Comma-separated optional sensors (FarmService.SENSORS); the soil probe is always on. */
    @Column(length = 200)
    private String sensors;

    @Column(nullable = false)
    private String fieldId;

    @Column(nullable = false)
    private String deviceId;

    /** The frontend's full setup draft (sowing date, soil, irrigation...), kept for its own screens. */
    @Column(length = 8000)
    private String profileJson;

    @Column(nullable = false)
    private Instant createdAt;

    @Column(nullable = false)
    private Instant updatedAt;

    protected FarmProfile() {}

    FarmProfile(String ownerEmail, String fieldId, String deviceId) {
        this.ownerEmail = ownerEmail;
        this.fieldId = fieldId;
        this.deviceId = deviceId;
        this.createdAt = Instant.now();
    }

    void update(String farmName, double landSize, String landUnit, String cropId, String state,
                String district, List<String> sensors, String profileJson) {
        this.farmName = farmName;
        this.landSize = landSize;
        this.landUnit = landUnit;
        this.cropId = cropId;
        this.state = state;
        this.district = district;
        this.sensors = String.join(",", sensors);
        this.profileJson = profileJson;
        this.updatedAt = Instant.now();
    }

    /** Land in hectares, whatever unit the farmer used. */
    double hectares() {
        return "ACRES".equals(landUnit) ? landSize / 2.47105 : landSize;
    }

    List<String> sensorList() {
        return sensors == null || sensors.isBlank() ? List.of() : Arrays.asList(sensors.split(","));
    }

    public String getOwnerEmail() { return ownerEmail; }
    public String getFarmName() { return farmName; }
    public double getLandSize() { return landSize; }
    public String getLandUnit() { return landUnit; }
    public String getCropId() { return cropId; }
    public String getState() { return state; }
    public String getDistrict() { return district; }
    public String getFieldId() { return fieldId; }
    public String getDeviceId() { return deviceId; }
    public String getProfileJson() { return profileJson; }
    public Instant getCreatedAt() { return createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
}

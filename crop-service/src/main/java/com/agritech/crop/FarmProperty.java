package com.agritech.crop;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.Table;
import jakarta.persistence.CascadeType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.OneToOne;
import jakarta.persistence.Transient;

import java.time.Instant;
import java.util.Arrays;
import java.util.List;

/** A separately registered property belonging to one authenticated account. */
@Entity
@Table(name = "farm_properties", indexes = @Index(name = "idx_property_owner", columnList = "ownerEmail"))
public class FarmProperty {

    /** The crop/field id is also a stable, unique property id. */
    @Id
    private String propertyId;

    @Column(nullable = false, length = 320)
    private String ownerEmail;

    @Column(nullable = false)
    private boolean defaultProperty;

    @Column(nullable = false, length = 80)
    private String farmName;

    private double landSize;

    @Column(nullable = false, length = 10)
    private String landUnit;

    @Column(nullable = false, length = 40)
    private String cropId;

    @Column(length = 60)
    private String state;

    @Column(length = 60)
    private String district;

    @Column(length = 200)
    private String sensors;

    @Column(nullable = false)
    private String fieldId;

    @Column(nullable = false)
    private String deviceId;

    @Column(length = 8000)
    private String profileJson;

    private Double latitude;
    private Double longitude;
    @Column(length = 500)
    private String address;
    @Column(length = 100000)
    private String boundaryGeoJson;
    @Column(length = 60)
    private String soilType;

    @OneToOne(mappedBy = "property", cascade = CascadeType.ALL, orphanRemoval = true)
    private PropertyWaterDetails waterDetails;

    @OneToOne(mappedBy = "property", cascade = CascadeType.ALL, orphanRemoval = true)
    private PropertyCropIntent cropIntent;

    @Column(nullable = false)
    private Instant createdAt;

    @Column(nullable = false)
    private Instant updatedAt;

    protected FarmProperty() {}

    FarmProperty(String propertyId, String ownerEmail, String fieldId, String deviceId, boolean defaultProperty) {
        this.propertyId = propertyId;
        this.ownerEmail = ownerEmail;
        this.fieldId = fieldId;
        this.deviceId = deviceId;
        this.defaultProperty = defaultProperty;
        this.createdAt = Instant.now();
    }

    static FarmProperty fromLegacy(FarmProfile legacy) {
        FarmProperty property = new FarmProperty(legacy.getFieldId(), legacy.getOwnerEmail(),
                legacy.getFieldId(), legacy.getDeviceId(), true);
        property.update(legacy.getFarmName(), legacy.getLandSize(), legacy.getLandUnit(), legacy.getCropId(),
                legacy.getState(), legacy.getDistrict(), legacy.sensorList(), legacy.getProfileJson(), null);
        property.createdAt = legacy.getCreatedAt();
        property.updatedAt = legacy.getUpdatedAt();
        return property;
    }

    void update(String farmName, double landSize, String landUnit, String cropId, String state,
                String district, List<String> sensors, String profileJson, java.util.Map<String, Object> profile) {
        this.farmName = farmName;
        this.landSize = landSize;
        this.landUnit = landUnit;
        this.cropId = cropId;
        this.state = state;
        this.district = district;
        this.sensors = String.join(",", sensors);
        this.profileJson = profileJson;
        this.latitude = number(profile, "lat");
        this.longitude = number(profile, "lon");
        this.address = string(profile, "address");
        this.boundaryGeoJson = string(profile, "boundaryGeoJson");
        this.soilType = string(profile, "soilType");
        String waterSource = string(profile, "waterSource");
        String waterAvailability = string(profile, "waterAvailability");
        String irrigationType = string(profile, "irrigationType");
        if (this.waterDetails == null) {
            this.waterDetails = new PropertyWaterDetails(this, waterSource, waterAvailability, irrigationType);
        } else {
            this.waterDetails.update(waterSource, waterAvailability, irrigationType);
        }
        String intent = string(profile, "cropIntent");
        String intendedSeason = string(profile, "intendedSeason");
        String intentStartDate = string(profile, "intentStartDate");
        String intentEndDate = string(profile, "intentEndDate");
        String previousCrops = string(profile, "previousCrops");
        if (this.cropIntent == null) {
            this.cropIntent = new PropertyCropIntent(this, intent, intendedSeason, intentStartDate,
                    intentEndDate, previousCrops);
        } else {
            this.cropIntent.update(intent, intendedSeason, intentStartDate, intentEndDate, previousCrops);
        }
        this.updatedAt = Instant.now();
    }

    private static Double number(java.util.Map<String, Object> profile, String key) {
        Object value = profile == null ? null : profile.get(key);
        return value instanceof Number n && Double.isFinite(n.doubleValue()) ? n.doubleValue() : null;
    }
    private static String string(java.util.Map<String, Object> profile, String key) {
        Object value = profile == null ? null : profile.get(key);
        if (value instanceof List<?> values) return String.join(",", values.stream().map(String::valueOf).toList());
        return value == null || String.valueOf(value).isBlank() ? null : String.valueOf(value);
    }

    double hectares() { return "ACRES".equals(landUnit) ? landSize / 2.47105 : landSize; }
    List<String> sensorList() { return sensors == null || sensors.isBlank() ? List.of() : Arrays.asList(sensors.split(",")); }
    String reportOwnerKey() { return defaultProperty ? ownerEmail : ownerEmail + "|" + propertyId; }

    public String getPropertyId() { return propertyId; }
    public String getOwnerEmail() { return ownerEmail; }
    public boolean isDefaultProperty() { return defaultProperty; }
    void setDefaultProperty(boolean defaultProperty) { this.defaultProperty = defaultProperty; }
    public String getFarmName() { return farmName; }
    public double getLandSize() { return landSize; }
    public String getLandUnit() { return landUnit; }
    public String getCropId() { return cropId; }
    public String getState() { return state; }
    public String getDistrict() { return district; }
    public String getFieldId() { return fieldId; }
    public String getDeviceId() { return deviceId; }
    public String getProfileJson() { return profileJson; }
    public Double getLatitude() { return latitude; }
    public Double getLongitude() { return longitude; }
    public String getAddress() { return address; }
    public String getBoundaryGeoJson() { return boundaryGeoJson; }
    public String getSoilType() { return soilType; }
    public PropertyWaterDetails getWaterDetails() { return waterDetails; }
    public PropertyCropIntent getCropIntent() { return cropIntent; }
    public Instant getCreatedAt() { return createdAt; }
}

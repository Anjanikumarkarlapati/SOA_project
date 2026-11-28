package com.agritech.crop;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.MapsId;
import jakarta.persistence.OneToOne;

/** Crop planning preference and optional cropping history for a property. */
@Entity
@Table(name = "property_crop_intent")
public class PropertyCropIntent {
    @Id
    @Column(name = "property_id", length = 64)
    private String propertyId;

    @MapsId
    @OneToOne
    @JoinColumn(name = "property_id")
    private FarmProperty property;

    @Column(length = 80)
    private String intent;
    @Column(length = 120)
    private String season;
    @Column(length = 10)
    private String startDate;
    @Column(length = 10)
    private String endDate;
    @Column(length = 1000)
    private String previousCrops;

    protected PropertyCropIntent() {}

    PropertyCropIntent(FarmProperty property, String intent, String season, String startDate,
                       String endDate, String previousCrops) {
        this.property = property;
        update(intent, season, startDate, endDate, previousCrops);
    }

    void update(String intent, String season, String startDate, String endDate, String previousCrops) {
        this.intent = intent;
        this.season = season;
        this.startDate = startDate;
        this.endDate = endDate;
        this.previousCrops = previousCrops;
    }

    public String getIntent() { return intent; }
    public String getSeason() { return season; }
    public String getStartDate() { return startDate; }
    public String getEndDate() { return endDate; }
    public String getPreviousCrops() { return previousCrops; }
}

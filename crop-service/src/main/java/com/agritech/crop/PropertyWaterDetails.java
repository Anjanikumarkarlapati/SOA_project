package com.agritech.crop;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.MapsId;
import jakarta.persistence.OneToOne;

/** Water access and irrigation choices for one property. */
@Entity
@Table(name = "property_water_details")
public class PropertyWaterDetails {
    @Id
    @Column(name = "property_id", length = 64)
    private String propertyId;

    @MapsId
    @OneToOne
    @JoinColumn(name = "property_id")
    private FarmProperty property;

    @Column(length = 40)
    private String waterSource;
    @Column(length = 80)
    private String availability;
    @Column(length = 40)
    private String irrigationType;

    protected PropertyWaterDetails() {}

    PropertyWaterDetails(FarmProperty property, String waterSource, String availability, String irrigationType) {
        this.property = property;
        update(waterSource, availability, irrigationType);
    }

    void update(String waterSource, String availability, String irrigationType) {
        this.waterSource = waterSource;
        this.availability = availability;
        this.irrigationType = irrigationType;
    }

    public String getWaterSource() { return waterSource; }
    public String getAvailability() { return availability; }
    public String getIrrigationType() { return irrigationType; }
}

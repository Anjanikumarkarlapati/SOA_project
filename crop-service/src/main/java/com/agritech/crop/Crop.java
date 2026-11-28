package com.agritech.crop;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.LocalDate;

/** A field planted with one crop. Its id doubles as the sensor fieldId (FR-5). */
@Entity
@Table(name = "crop_fields")
public class Crop {

    @Id
    private String cropId;

    @Column(nullable = false)
    private String farmId;

    @Column(nullable = false)
    private String name;

    @Column(nullable = false)
    private String cropType;

    /** Irrigation zone valve that waters this field. */
    private String valveId;

    private double areaHectares;
    private LocalDate plantedOn;

    // Optimal envelope for this crop type (FR-6).
    private double moistureMin;
    private double moistureMax;
    private double temperatureMin;
    private double temperatureMax;
    private double phMin;
    private double phMax;

    protected Crop() {}

    public Crop(String cropId, String farmId, String name, String cropType, String valveId,
                double areaHectares, LocalDate plantedOn,
                double moistureMin, double moistureMax,
                double temperatureMin, double temperatureMax,
                double phMin, double phMax) {
        this.cropId = cropId;
        this.farmId = farmId;
        this.name = name;
        this.cropType = cropType;
        this.valveId = valveId;
        this.areaHectares = areaHectares;
        this.plantedOn = plantedOn;
        this.moistureMin = moistureMin;
        this.moistureMax = moistureMax;
        this.temperatureMin = temperatureMin;
        this.temperatureMax = temperatureMax;
        this.phMin = phMin;
        this.phMax = phMax;
    }

    static String newId() {
        return "CROP-" + java.util.UUID.randomUUID().toString().substring(0, 8).toUpperCase();
    }

    /** A new field planted today, with the crop's optimal envelope from the catalog. */
    static Crop of(String cropId, String farmId, String name, CropCatalog.Spec spec, double areaHectares) {
        Crop crop = new Crop(cropId, farmId, name, spec.name(), null, areaHectares, LocalDate.now(),
                0, 0, 0, 0, 0, 0);
        crop.apply(name, spec, areaHectares);
        return crop;
    }

    /** The farmer changed crop or land size: re-point the field at the new crop's envelope. */
    void apply(String name, CropCatalog.Spec spec, double areaHectares) {
        this.name = name;
        this.cropType = spec.name();
        this.areaHectares = areaHectares;
        this.moistureMin = spec.moisture().min();
        this.moistureMax = spec.moisture().max();
        this.temperatureMin = spec.temperature().min();
        this.temperatureMax = spec.temperature().max();
        this.phMin = spec.ph().min();
        this.phMax = spec.ph().max();
    }

    /**
     * Rename or resize the field while keeping its crop, so the optimal envelope the health score
     * is graded against is left untouched. {@link #apply} cannot be used here: it rebuilds every
     * band from a catalog {@code Spec}, and a {@code Spec} cannot be reconstructed from the three
     * bands stored on this row.
     */
    void relabel(String name, double areaHectares) {
        this.name = name;
        this.areaHectares = areaHectares;
    }

    public String getCropId() { return cropId; }
    public String getFarmId() { return farmId; }
    public String getName() { return name; }
    public String getCropType() { return cropType; }
    public String getValveId() { return valveId; }
    public double getAreaHectares() { return areaHectares; }
    public LocalDate getPlantedOn() { return plantedOn; }
    public double getMoistureMin() { return moistureMin; }
    public double getMoistureMax() { return moistureMax; }
    public double getTemperatureMin() { return temperatureMin; }
    public double getTemperatureMax() { return temperatureMax; }
    public double getPhMin() { return phMin; }
    public double getPhMax() { return phMax; }
}

package com.agritech.crop;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.LocalDate;

/** A field planted with one crop. Its id doubles as the sensor fieldId (FR-5). */
@Entity
@Table(name = "crops")
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

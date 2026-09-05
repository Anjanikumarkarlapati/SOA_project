package com.agritech.crop;

import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Component;

import java.time.LocalDate;

/** Pilot farm layout - the four fields the sensor fleet reports against. */
@Component
public class CropSeed implements CommandLineRunner {

    private final CropRepository crops;

    public CropSeed(CropRepository crops) { this.crops = crops; }

    @Override
    public void run(String... args) {
        if (crops.count() > 0) return;
        LocalDate today = LocalDate.now();

        crops.save(new Crop("CROP-FIELD-01", "FARM-001", "North Field", "Maize", "VALVE-FIELD-01",
                12.5, today.minusDays(46), 55, 75, 18, 27, 5.8, 7.0));
        crops.save(new Crop("CROP-FIELD-02", "FARM-001", "River Paddock", "Wheat", "VALVE-FIELD-02",
                8.0, today.minusDays(61), 45, 65, 15, 24, 6.0, 7.5));
        crops.save(new Crop("CROP-FIELD-03", "FARM-001", "South Terrace", "Tomato", "VALVE-FIELD-03",
                4.2, today.minusDays(28), 60, 80, 18, 26, 6.0, 6.8));
        crops.save(new Crop("CROP-FIELD-04", "FARM-001", "West Block", "Soybean", "VALVE-FIELD-04",
                15.0, today.minusDays(72), 50, 70, 20, 30, 6.0, 7.0));
    }
}

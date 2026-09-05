package com.agritech.crop;

import org.junit.jupiter.api.Test;

import java.time.LocalDate;

import static org.junit.jupiter.api.Assertions.*;

class HealthScoreTest {

    /** Maize: moisture 55-75%, temperature 18-27 C, pH 5.8-7.0. */
    private final Crop maize = new Crop("CROP-FIELD-01", "FARM-001", "North Field", "Maize",
            "VALVE-FIELD-01", 12.5, LocalDate.now(), 55, 75, 18, 27, 5.8, 7.0);

    @Test
    void everythingInsideTheBandScoresFull() {
        HealthScore.Result r = HealthScore.evaluate(maize, 65, 22, 6.4, 0);

        assertEquals(100, r.score());
        assertEquals("OPTIMAL", r.moistureStatus());
        assertEquals("OPTIMAL", r.temperatureStatus());
        assertEquals("OPTIMAL", r.phStatus());
        assertNull(r.hoursToIrrigation());
        assertTrue(r.recommendations().get(0).contains("maintain"),
                "expected a hold-steady recommendation, got: " + r.recommendations());
    }

    @Test
    void mildDriftIsAWarningAndFarDriftIsCritical() {
        // Band is 20 wide, warning margin 35% -> up to 7 points outside is still a warning.
        assertEquals("WARNING", HealthScore.evaluate(maize, 50, 22, 6.4, 0).moistureStatus());
        assertEquals("CRITICAL", HealthScore.evaluate(maize, 28, 22, 6.4, 0).moistureStatus());
    }

    @Test
    void aDryFieldScoresBelowAHealthyOneAndAsksForWater() {
        HealthScore.Result healthy = HealthScore.evaluate(maize, 65, 22, 6.4, 0);
        HealthScore.Result dry = HealthScore.evaluate(maize, 28, 22, 6.4, 0);

        assertTrue(dry.score() < healthy.score());
        assertTrue(dry.recommendations().get(0).contains("irrigation recommended"),
                "expected an irrigation recommendation, got: " + dry.recommendations());
    }

    @Test
    void irrigationForecastOnlyFiresWhenTheSoilIsActuallyDrying() {
        // Drying 0.5%/h from 65% with a floor of 55% -> 20 hours of headroom.
        assertEquals(20.0, HealthScore.hoursUntilDry(65, 55, -0.5));

        assertNull(HealthScore.hoursUntilDry(65, 55, 0.4), "wetting soil needs no forecast");
        assertNull(HealthScore.hoursUntilDry(65, 55, -0.05), "beyond the 48h horizon is noise");
        assertEquals(0.0, HealthScore.hoursUntilDry(50, 55, -0.5), "already below optimal");
    }

    @Test
    void weightingFavoursMoistureOverPh() {
        int moistureOff = HealthScore.evaluate(maize, 45, 22, 6.4, 0).score();
        int phOff = HealthScore.evaluate(maize, 65, 22, 5.2, 0).score();

        assertTrue(moistureOff < phOff,
                "moisture is weighted heaviest, so the same-sized drift should cost more");
    }
}

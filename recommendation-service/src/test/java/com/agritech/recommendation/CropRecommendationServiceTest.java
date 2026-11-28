package com.agritech.recommendation;

import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

class CropRecommendationServiceTest {
    private static final CropRecommendationService.Weights WEIGHTS =
            new CropRecommendationService.Weights(.30, .25, .15, .15, .15);

    private static ClimateStatistics.Summary climate(double meanTemp, double dailyRain) {
        var temperature = new ClimateStatistics.Distribution(3650, meanTemp, meanTemp, 2.0,
                meanTemp - 5, meanTemp - 2, meanTemp + 2, meanTemp + 5);
        var rainfall = new ClimateStatistics.Distribution(3650, dailyRain, dailyRain, 3.0,
                0.0, 0.0, dailyRain + 2, dailyRain + 10);
        return new ClimateStatistics.Summary(temperature, rainfall, 0.0, 0.0,
                2500.0, 1400.0, 2500.0, 0.0, 0.0, 5.0);
    }

    @Test
    void expectedCropScoreUsesDocumentedWeightsAndReturnsSeasonWindows() {
        var context = new CropRecommendationService.Context(climate(20, 10), "alluvial", "canal", "year-round",
                "GROW_NOW", LocalDate.of(2026, 12, 1));

        var result = CropRecommendationService.score(CropCatalog.find("wheat").orElseThrow(), context, WEIGHTS);

        assertEquals(97.8, result.score(), .1);
        assertEquals(100.0, result.temperatureFit());
        assertEquals(100.0, result.waterFit());
        assertEquals(90.0, result.soilMatch());
        assertEquals(95.0, result.seasonFit());
        assertEquals("LOW", result.riskLevel());
        assertEquals("2026-12-01", result.sowingWindow());
        assertEquals("2027-03-17 to 2027-04-14", result.harvestWindow());
    }

    @Test
    void rainFedLimitedWaterReducesSuitabilityAndExplainsCoverage() {
        var context = new CropRecommendationService.Context(climate(45, 0), "sandy", "rain-fed", "limited",
                "GROW_NOW", LocalDate.of(2026, 7, 1));

        var result = CropRecommendationService.score(CropCatalog.find("wheat").orElseThrow(), context, WEIGHTS);

        assertEquals(0.0, result.waterFit());
        assertEquals("HIGH", result.riskLevel());
        assertTrue(result.explanation().contains("limited estimated water coverage"));
    }

    @Test
    void recommendationsAreSortedAndCappedAtFive() {
        CropRecommendationService service = new CropRecommendationService(.30, .25, .15, .15, .15);
        var context = new CropRecommendationService.Context(climate(26, 5), "black", "borewell", "year-round",
                "RECOMMEND_BEST", LocalDate.of(2026, 7, 1));

        List<CropRecommendationService.Recommendation> result = service.recommend(context, 30);

        assertEquals(5, result.size());
        assertTrue(result.get(0).score() >= result.get(1).score());
        assertTrue(result.stream().allMatch(r -> r.score() >= 0 && r.score() <= 100));
    }
}

package com.agritech.climate;

import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

class ClimateStatisticsTest {
    @Test
    void calculatesDistributionPercentilesGddEt0AndWaterBalance() {
        var days = List.of(
                new ClimateStatistics.Day(LocalDate.of(2020, 1, 1), 15.0, 10.0, 20.0, 0.0, 4.0),
                new ClimateStatistics.Day(LocalDate.of(2021, 1, 1), 25.0, 20.0, 30.0, 10.0, 5.0));

        ClimateStatistics.Summary summary = ClimateStatistics.summarize(days);

        assertEquals(20, summary.temperatureC().mean(), .001);
        assertEquals(20, summary.temperatureC().median(), .001);
        assertEquals(5, summary.temperatureC().standardDeviation(), .001);
        assertEquals(15.5, summary.temperatureC().p05(), .001);
        assertEquals(24.5, summary.temperatureC().p95(), .001);
        assertEquals(5, summary.rainfallMm().mean(), .001);
        assertEquals(20, summary.growingDegreeDays(), .001);
        assertEquals(9, summary.referenceEvapotranspirationMm(), .001);
        assertEquals(1, summary.waterBalanceMm(), .001);
        assertEquals(0, summary.droughtRiskPercent(), .001);
        assertEquals(0, summary.heatStressRiskPercent(), .001);
        assertEquals(50, summary.extremeEventProbabilityPercent(), .001);
    }

    @Test
    void leavesStatisticsNullWhenAWeatherVariableIsUnavailable() {
        ClimateStatistics.Summary summary = ClimateStatistics.summarize(List.of(
                new ClimateStatistics.Day(LocalDate.of(2024, 5, 1), null, null, null, null, null)));

        assertEquals(0, summary.temperatureC().count());
        assertNull(summary.temperatureC().mean());
        assertEquals(0, summary.rainfallMm().count());
        assertNull(summary.waterBalanceMm());
        assertNull(summary.temperatureTrendCPerDecade());
        assertNull(summary.droughtRiskPercent());
    }
}

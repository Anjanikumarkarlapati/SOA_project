package com.agritech.recommendation;

import java.time.LocalDate;
import java.util.Comparator;
import java.util.List;
import java.util.function.Function;

/** Deterministic climate summaries. The formula notes are included for auditability. */
public final class ClimateStatistics {
    private ClimateStatistics() {}

    public record Day(LocalDate date, Double tempMeanC, Double tempMinC, Double tempMaxC,
               Double rainfallMm, Double et0Mm) {}
    public record Distribution(long count, Double mean, Double median, Double standardDeviation,
                        Double p05, Double p25, Double p75, Double p95) {}
    public record Summary(Distribution temperatureC, Distribution rainfallMm,
                   Double temperatureTrendCPerDecade, Double rainfallTrendMmPerDecade,
                   Double growingDegreeDays, Double referenceEvapotranspirationMm,
                   Double waterBalanceMm, Double droughtRiskPercent, Double heatStressRiskPercent,
                   Double extremeEventProbabilityPercent) {}

    public static Summary summarize(List<Day> input) {
        List<Day> days = input.stream().sorted(Comparator.comparing(Day::date)).toList();
        List<Day> temperatures = days.stream().filter(d -> d.tempMeanC() != null).toList();
        List<Day> rainDays = days.stream().filter(d -> d.rainfallMm() != null).toList();
        List<Day> waterDays = days.stream().filter(d -> d.rainfallMm() != null && d.et0Mm() != null).toList();
        List<Day> hotDays = days.stream().filter(d -> d.tempMaxC() != null).toList();
        Double rain95 = percentile(rainDays.stream().map(Day::rainfallMm).toList(), .95);
        Double temp95 = percentile(hotDays.stream().map(Day::tempMaxC).toList(), .95);

        // GDD = sum(max(0, (Tmax + Tmin) / 2 - base temperature)); base is 10 °C.
        List<Day> degreeDays = days.stream().filter(d -> d.tempMinC() != null && d.tempMaxC() != null).toList();
        Double gdd = degreeDays.isEmpty() ? null : degreeDays.stream()
                .mapToDouble(d -> Math.max(0, (d.tempMaxC() + d.tempMinC()) / 2 - 10)).sum();
        List<Day> et0Days = days.stream().filter(d -> d.et0Mm() != null).toList();
        Double et0 = et0Days.isEmpty() ? null : et0Days.stream().mapToDouble(Day::et0Mm).sum();
        // Seasonal water balance = total precipitation minus reference evapotranspiration.
        Double balance = waterDays.isEmpty() ? null : waterDays.stream()
                .mapToDouble(d -> d.rainfallMm() - d.et0Mm()).sum();
        // Drought risk is the share of days with a net climatic deficit larger than 5 mm.
        Double drought = share(waterDays.stream().filter(d -> d.rainfallMm() - d.et0Mm() < -5).count(), waterDays.size());
        // Heat risk is the share of days whose daily maximum exceeds 35 °C.
        Double heat = share(hotDays.stream().filter(d -> d.tempMaxC() > 35).count(), hotDays.size());
        // Extreme-event probability is the share of days beyond either variable's 95th percentile.
        long extremeCount = days.stream().filter(d -> (d.rainfallMm() != null && rain95 != null && d.rainfallMm() > rain95)
                || (d.tempMaxC() != null && temp95 != null && d.tempMaxC() > temp95)).count();
        Double extreme = share(extremeCount, days.size());
        return new Summary(distribution(temperatures, Day::tempMeanC), distribution(rainDays, Day::rainfallMm),
                trend(temperatures, Day::tempMeanC), trend(rainDays, Day::rainfallMm), gdd, et0,
                balance, drought, heat, extreme);
    }

    private static Double share(long count, long total) { return total == 0 ? null : count * 100.0 / total; }

    private static Distribution distribution(List<Day> days, Function<Day, Double> value) {
        List<Double> values = days.stream().map(value).filter(v -> v != null && Double.isFinite(v)).sorted().toList();
        if (values.isEmpty()) return new Distribution(0, null, null, null, null, null, null, null);
        double mean = values.stream().mapToDouble(Double::doubleValue).average().orElseThrow();
        // Population standard deviation: divide squared deviations by N (the observed period is the population summarized).
        double sd = Math.sqrt(values.stream().mapToDouble(v -> Math.pow(v - mean, 2)).sum() / values.size());
        return new Distribution(values.size(), mean, percentile(values, .5), sd,
                percentile(values, .05), percentile(values, .25), percentile(values, .75), percentile(values, .95));
    }

    /** Type-7 percentile: linear interpolation at position p * (n - 1). */
    private static Double percentile(List<Double> source, double p) {
        List<Double> values = source.stream().filter(v -> v != null && Double.isFinite(v)).sorted().toList();
        if (values.isEmpty()) return null;
        double index = p * (values.size() - 1);
        int lower = (int) Math.floor(index), upper = (int) Math.ceil(index);
        return values.get(lower) + (values.get(upper) - values.get(lower)) * (index - lower);
    }

    /** OLS trend: covariance(day offset, value) / variance(day offset), scaled to a 365.2425-day decade. */
    private static Double trend(List<Day> days, Function<Day, Double> value) {
        List<Day> valid = days.stream().filter(d -> value.apply(d) != null && Double.isFinite(value.apply(d))).toList();
        if (valid.size() < 2) return null;
        LocalDate origin = valid.get(0).date();
        double meanX = valid.stream().mapToDouble(d -> d.date().toEpochDay() - origin.toEpochDay()).average().orElseThrow();
        double meanY = valid.stream().mapToDouble(d -> value.apply(d)).average().orElseThrow();
        double covariance = valid.stream().mapToDouble(d -> (d.date().toEpochDay() - origin.toEpochDay() - meanX)
                * (value.apply(d) - meanY)).sum();
        double variance = valid.stream().mapToDouble(d -> Math.pow(d.date().toEpochDay() - origin.toEpochDay() - meanX, 2)).sum();
        return variance == 0 ? null : covariance / variance * 3652.425;
    }
}

package com.agritech.crop;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.DoubleSummaryStatistics;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.function.Function;

/**
 * Turns one day of a farm's sensor readings into a daily report: per-sensor averages graded
 * against the crop's ranges, an overall condition, alerts that say what an abnormal reading means,
 * practical recommendations and a short summary. Pure - no I/O - so every rule is unit-testable.
 */
public final class ReportBuilder {

    /** Within this fraction of a band width outside the optimal range still counts as NORMAL. */
    static final double NORMAL_MARGIN = 0.10;
    /** Beyond NORMAL and up to this fraction is WARNING; further out is CRITICAL. */
    static final double WARNING_MARGIN = 0.35;

    private ReportBuilder() {}

    public record FarmInfo(String name, double landSize, String landUnit, double hectares, String crop,
                           String cropId, String location, List<String> sensors) {}

    /**
     * One sensor's day. {@code value} is what is graded: the daily average, except light (the
     * midday peak - an average would count the night) and rain (the day's total, not graded).
     */
    public record MetricSummary(String key, String label, String unit, String basis, Double value,
                                Double min, Double max, Double optimalMin, Double optimalMax, String status) {}

    public record Alert(String severity, String metric, String message) {}

    public record Recommendation(String category, String text) {}

    public record Report(boolean simulated, String dataSource, FarmInfo farm, String date, boolean complete,
                         int readings, List<MetricSummary> sensors, String condition, String conditionLabel,
                         List<Alert> alerts, List<Recommendation> recommendations, String summary,
                         PublicWeatherClient.DailyWeather weather) {}

    /** A measurement: its JSON key, label, unit, the sensor that provides it and its crop range. */
    record Metric(String key, String label, String unit, String sensor, Function<CropCatalog.Spec, CropCatalog.Range> range) {}

    static final List<Metric> METRICS = List.of(
            new Metric("soilMoisture", "Soil moisture", "%", "soil", CropCatalog.Spec::moisture),
            new Metric("soilTemperature", "Soil temperature", "°C", "soil", CropCatalog.Spec::temperature),
            new Metric("ph", "Soil pH", "", "soil", CropCatalog.Spec::ph),
            new Metric("airTemperature", "Air temperature", "°C", "air-temperature", CropCatalog.Spec::temperature),
            new Metric("humidity", "Humidity", "%", "humidity", CropCatalog.Spec::humidity),
            new Metric("lightLux", "Light intensity", "lux", "light", CropCatalog.Spec::light),
            new Metric("nitrogen", "Nitrogen (N)", "mg/kg", "npk", CropCatalog.Spec::n),
            new Metric("phosphorus", "Phosphorus (P)", "mg/kg", "npk", CropCatalog.Spec::p),
            new Metric("potassium", "Potassium (K)", "mg/kg", "npk", CropCatalog.Spec::k),
            new Metric("rainfallMm", "Rainfall", "mm", "rainfall", s -> null),
            new Metric("waterLevelMm", "Standing water", "mm", "water-level", CropCatalog.Spec::waterLevel));

    /** OPTIMAL inside the band, then NORMAL / WARNING / CRITICAL by distance outside it. */
    public static String grade(double value, CropCatalog.Range range) {
        if (range == null) return null;
        if (value >= range.min() && value <= range.max()) return "OPTIMAL";
        double distance = value < range.min() ? range.min() - value : value - range.max();
        double bands = distance / range.width();
        if (bands <= NORMAL_MARGIN) return "NORMAL";
        return bands <= WARNING_MARGIN ? "WARNING" : "CRITICAL";
    }

    /** Is the metric reported by a farm with these sensors? The soil probe is always present. */
    static boolean enabled(Metric m, List<String> sensors) {
        return "soil".equals(m.sensor()) || sensors.contains(m.sensor());
    }

    public static Report build(CropCatalog.Spec spec, FarmInfo farm, LocalDate date, boolean complete,
                               List<Map<String, Object>> readings) {
        return build(spec, farm, date, complete, readings, null);
    }

    public static Report build(CropCatalog.Spec spec, FarmInfo farm, LocalDate date, boolean complete,
                               List<Map<String, Object>> readings, PublicWeatherClient.DailyWeather weather) {
        List<MetricSummary> metrics = new ArrayList<>();
        for (Metric m : METRICS) {
            if (!enabled(m, farm.sensors())) continue;
            DoubleSummaryStatistics stats = readings.stream()
                    .map(r -> r.get(m.key()))
                    .filter(v -> v instanceof Number)
                    .mapToDouble(v -> ((Number) v).doubleValue())
                    .summaryStatistics();
            if (stats.getCount() == 0) continue;
            CropCatalog.Range range = m.range().apply(spec);
            String basis;
            double value;
            if ("lightLux".equals(m.key())) {
                basis = "peak";
                value = stats.getMax();
            } else if ("rainfallMm".equals(m.key())) {
                basis = "total";
                value = stats.getSum();
            } else {
                basis = "average";
                value = stats.getAverage();
            }
            metrics.add(new MetricSummary(m.key(), m.label(), m.unit(), basis, round(value),
                    round(stats.getMin()), round(stats.getMax()),
                    range == null ? null : range.min(), range == null ? null : range.max(),
                    range == null ? null : grade(value, range)));
        }

        if (metrics.isEmpty()) {
            return new Report(true, DATA_SOURCE, farm, date.toString(), complete, 0, List.of(), "NO_DATA",
                    "No data", List.of(), List.of(new Recommendation("GENERAL",
                    "No sensor readings were received for this day. Check that the farm's sensors are online.")),
                    "No sensor data was available for " + farm.name() + " on " + date + ".", weather);
        }

        List<Alert> alerts = alerts(spec, metrics);
        String condition = condition(metrics, alerts);
        List<Recommendation> recommendations = recommendations(spec, metrics);
        return new Report(true, DATA_SOURCE, farm, date.toString(), complete, readings.size(), metrics,
                condition, label(condition), alerts, recommendations,
                summary(spec, farm, date, complete, metrics, condition, alerts, recommendations), weather);
    }

    static final String DATA_SOURCE =
            "Simulated sensor data: no physical sensors are connected yet. Readings are generated "
                    + "from a model tuned to this farm's crop and conditions.";

    /* ---------- Condition ---------- */

    static String condition(List<MetricSummary> metrics, List<Alert> alerts) {
        boolean critical = metrics.stream().anyMatch(m -> "CRITICAL".equals(m.status()))
                || alerts.stream().anyMatch(a -> "CRITICAL".equals(a.severity()));
        if (critical) return "CRITICAL";
        if (metrics.stream().anyMatch(m -> "WARNING".equals(m.status())) || !alerts.isEmpty()) return "NEEDS_ATTENTION";
        if (metrics.stream().anyMatch(m -> "NORMAL".equals(m.status()))) return "ACCEPTABLE";
        return "OPTIMAL";
    }

    static String label(String condition) {
        return switch (condition) {
            case "OPTIMAL" -> "Optimal";
            case "ACCEPTABLE" -> "Acceptable";
            case "NEEDS_ATTENTION" -> "Needs attention";
            case "CRITICAL" -> "Critical";
            default -> "No data";
        };
    }

    /* ---------- Alerts ---------- */

    static List<Alert> alerts(CropCatalog.Spec spec, List<MetricSummary> metrics) {
        List<Alert> alerts = new ArrayList<>();
        String crop = spec.name();
        for (MetricSummary m : metrics) {
            if ("WARNING".equals(m.status()) || "CRITICAL".equals(m.status())) {
                boolean low = m.value() < m.optimalMin();
                alerts.add(new Alert(m.status(), m.key(), String.format(Locale.ROOT,
                        "%s %s %s - %s the recommended %s for %s. %s",
                        m.label(), "peak".equals(m.basis()) ? "peaked at" : "averaged", withUnit(m.value(), m.unit()),
                        low ? "below" : "above", range(m), crop, meaning(m.key(), low, spec))));
            }
        }
        // Daily extremes can hurt a crop even when the average looks fine.
        metric(metrics, "airTemperature").ifPresent(t -> {
            if (t.max() != null && t.max() > spec.temperature().max() + 3) {
                alerts.add(new Alert("WARNING", "airTemperature", String.format(Locale.ROOT,
                        "Afternoon temperature peaked at %s °C, above the %s °C a %s crop tolerates well. "
                                + "Heat stress can cause flower and fruit drop.",
                        fmt(t.max()), fmt(spec.temperature().max()), crop)));
            }
            if (t.min() != null && t.min() < spec.temperature().min() - 3) {
                alerts.add(new Alert("WARNING", "airTemperature", String.format(Locale.ROOT,
                        "Night temperature dropped to %s °C, below the %s °C minimum for %s. "
                                + "Cold slows growth and young plants risk chilling injury.",
                        fmt(t.min()), fmt(spec.temperature().min()), crop)));
            }
        });
        alerts.sort((a, b) -> Boolean.compare("CRITICAL".equals(b.severity()), "CRITICAL".equals(a.severity())));
        return alerts;
    }

    /** What an out-of-range reading means for the crop, in a farmer's terms. */
    static String meaning(String key, boolean low, CropCatalog.Spec spec) {
        return switch (key) {
            case "soilMoisture" -> low
                    ? "The roots are short of water; irrigation may be required."
                    : "Waterlogged roots can rot and nutrients wash out of the root zone.";
            case "soilTemperature" -> low
                    ? "Cold soil slows root growth and nutrient uptake."
                    : "Hot soil stresses roots and dries the topsoil quickly.";
            case "ph" -> low
                    ? "Acidic soil locks up phosphorus and can release toxic aluminium."
                    : "Alkaline soil limits iron, zinc and phosphorus uptake.";
            case "airTemperature" -> low
                    ? "Cold weather slows growth and can damage young plants."
                    : "Heat stress can cause flower drop and poor grain or fruit filling.";
            case "humidity" -> low
                    ? "Dry air raises water loss from the leaves."
                    : spec.fungal()
                            ? "Humid conditions favour fungal diseases this crop is prone to."
                            : "Humid conditions favour fungal diseases and some pests.";
            case "lightLux" -> low
                    ? "Weak light slows photosynthesis and growth."
                    : "Very strong light can scorch leaves of shade-loving crops.";
            case "nitrogen" -> low
                    ? "Nitrogen deficiency shows as yellowing older leaves and slow growth."
                    : "Excess nitrogen gives soft, leafy growth that attracts pests.";
            case "phosphorus" -> low
                    ? "Low phosphorus means weak roots and delayed flowering."
                    : "Excess phosphorus can block zinc uptake.";
            case "potassium" -> low
                    ? "Low potassium weakens stems and lowers fruit and grain quality."
                    : "Excess potassium can limit calcium and magnesium uptake.";
            case "waterLevelMm" -> low
                    ? "The paddy is drying out; rice yield drops if the field cracks."
                    : "Deep standing water wastes water and can weaken tillering.";
            default -> "";
        };
    }

    /* ---------- Recommendations ---------- */

    static List<Recommendation> recommendations(CropCatalog.Spec spec, List<MetricSummary> metrics) {
        List<Recommendation> out = new ArrayList<>();
        String crop = spec.name();
        double rain = metric(metrics, "rainfallMm").map(MetricSummary::value).orElse(0.0);

        metric(metrics, "soilMoisture").ifPresent(m -> {
            if (isLow(m)) {
                out.add(new Recommendation("IRRIGATION", rain >= 10
                        ? String.format(Locale.ROOT, "%s mm of rain fell today. Check soil moisture once it settles; "
                        + "if it stays below %s%%, irrigate early tomorrow morning.", fmt(rain), fmt(m.optimalMin()))
                        : String.format(Locale.ROOT, "Irrigate within the next 24 hours, preferably between 5 and 9 AM "
                        + "to cut evaporation, to bring soil moisture back above %s%%.", fmt(m.optimalMin()))));
            } else if (isHigh(m)) {
                out.add(new Recommendation("IRRIGATION", "Hold irrigation until the soil drains below "
                        + fmt(m.optimalMax()) + "%. Open field drains so water does not stand around the roots."));
            } else if (rain >= 10) {
                out.add(new Recommendation("IRRIGATION", String.format(Locale.ROOT,
                        "Today's %s mm of rain covers the crop's need. Skip the next scheduled irrigation.", fmt(rain))));
            } else {
                out.add(new Recommendation("IRRIGATION",
                        "Soil moisture is on track. Keep the current watering schedule and water early in the morning."));
            }
        });
        metric(metrics, "waterLevelMm").filter(m -> m.status() != null).ifPresent(m -> {
            if (isLow(m)) out.add(new Recommendation("WATER", "Refill the paddy to about 50 mm of standing water."));
            else if (isHigh(m)) out.add(new Recommendation("WATER", "Drain the paddy down to about 50 mm to save water."));
        });
        metric(metrics, "airTemperature").ifPresent(m -> {
            if (isHigh(m) || (m.max() != null && m.max() > spec.temperature().max() + 3)) {
                out.add(new Recommendation("TEMPERATURE", "Expect heat stress: irrigate in the early morning or evening, "
                        + "mulch to keep the soil cool, and avoid spraying in the midday heat."));
            } else if (isLow(m) || (m.min() != null && m.min() < spec.temperature().min() - 3)) {
                out.add(new Recommendation("TEMPERATURE", "Cold nights: a light evening irrigation helps protect against "
                        + "frost, and nursery beds should be covered overnight."));
            }
        });
        metric(metrics, "humidity").ifPresent(m -> {
            if (isHigh(m)) {
                out.add(new Recommendation("DISEASE", spec.fungal()
                        ? "High humidity raises the risk of fungal disease in " + crop + ". Scout leaves for spots or "
                        + "blight, improve airflow between rows, and ask your Krishi Vigyan Kendra about a preventive spray."
                        : "High humidity: watch for fungal spots and sap-sucking pests during field scouting."));
            } else if (isLow(m)) {
                out.add(new Recommendation("DISEASE", "Dry air: mulch the beds and shorten the interval between irrigations."));
            }
        });
        metric(metrics, "ph").ifPresent(m -> {
            if (isLow(m)) out.add(new Recommendation("SOIL", "Soil is too acidic. Apply agricultural lime (dolomite) "
                    + "at the rate a soil test recommends, then re-test after the season."));
            else if (isHigh(m)) out.add(new Recommendation("SOIL", "Soil is too alkaline. Add gypsum and well-rotted "
                    + "organic manure, and prefer acidifying fertilisers such as ammonium sulphate."));
        });
        metric(metrics, "nitrogen").ifPresent(m -> {
            if (isLow(m)) out.add(new Recommendation("NUTRIENTS", "Nitrogen is low: top-dress urea in split doses, "
                    + "applied after irrigation so it is not lost."));
            else if (isHigh(m)) out.add(new Recommendation("NUTRIENTS", "Nitrogen is high: skip the next nitrogen dose."));
        });
        metric(metrics, "phosphorus").ifPresent(m -> {
            if (isLow(m)) out.add(new Recommendation("NUTRIENTS", "Phosphorus is low: apply DAP or single super phosphate near the root zone."));
            else if (isHigh(m)) out.add(new Recommendation("NUTRIENTS", "Phosphorus is high: skip DAP and other phosphate "
                    + "fertilisers this season, and consider a zinc sulphate application if leaves show zinc deficiency."));
        });
        metric(metrics, "potassium").ifPresent(m -> {
            if (isLow(m)) out.add(new Recommendation("NUTRIENTS", "Potassium is low: apply muriate of potash (MOP)."));
            else if (isHigh(m)) out.add(new Recommendation("NUTRIENTS", "Potassium is high: skip potash fertiliser this season."));
        });
        metric(metrics, "lightLux").ifPresent(m -> {
            if (isLow(m)) out.add(new Recommendation("LIGHT", "Light was weak today. Clear weeds or branches that shade "
                    + "the crop; on cloudy spells expect slower growth and avoid overwatering."));
            else if (isHigh(m)) out.add(new Recommendation("LIGHT", "Light is stronger than " + crop
                    + " prefers. Use shade nets or shade trees during the hottest hours."));
        });
        out.add(new Recommendation("GENERAL", "Walk the field twice a week to check for pests and disease, "
                + "and keep a record of irrigation and fertiliser applied."));
        return out;
    }

    /* ---------- Summary ---------- */

    static String summary(CropCatalog.Spec spec, FarmInfo farm, LocalDate date, boolean complete,
                          List<MetricSummary> metrics, String condition, List<Alert> alerts,
                          List<Recommendation> recommendations) {
        StringBuilder s = new StringBuilder();
        String state = switch (condition) {
            case "NEEDS_ATTENTION" -> complete ? "needed attention" : "needs attention";
            default -> (complete ? "was in " : "is in ") + label(condition).toLowerCase(Locale.ROOT) + " condition";
        };
        s.append(String.format(Locale.ROOT, "%s on %s (%s %s) %s %s.",
                spec.name(), farm.name(), fmt(farm.landSize()), farm.landUnit().toLowerCase(Locale.ROOT),
                state, complete ? "on " + date : "so far today"));
        List<String> parts = new ArrayList<>();
        metric(metrics, "soilMoisture").ifPresent(m -> parts.add(String.format(Locale.ROOT,
                "soil moisture averaged %s%% (best %s-%s%%)", fmt(m.value()), fmt(m.optimalMin()), fmt(m.optimalMax()))));
        metric(metrics, "airTemperature").ifPresent(m -> parts.add("air temperature " + fmt(m.value()) + " °C"));
        metric(metrics, "humidity").ifPresent(m -> parts.add("humidity " + fmt(m.value()) + "%"));
        metric(metrics, "rainfallMm").filter(m -> m.value() > 0).ifPresent(m -> parts.add(fmt(m.value()) + " mm of rain"));
        if (!parts.isEmpty()) s.append(" ").append(capitalise(String.join(", ", parts))).append('.');
        if (alerts.isEmpty()) {
            s.append(" No readings were out of range.");
        } else {
            List<String> labels = alerts.stream().map(Alert::metric).distinct()
                    .map(k -> METRICS.stream().filter(m -> m.key().equals(k)).findFirst().map(Metric::label).orElse(k))
                    .toList();
            s.append(" ").append(alerts.size() == 1 ? "One reading needs" : alerts.size() + " readings need")
                    .append(" attention: ").append(String.join(", ", labels)).append('.');
        }
        recommendations.stream().findFirst().ifPresent(r -> s.append(" ").append(r.text()));
        return s.toString();
    }

    /* ---------- helpers ---------- */

    private static java.util.Optional<MetricSummary> metric(List<MetricSummary> metrics, String key) {
        return metrics.stream().filter(m -> m.key().equals(key)).findFirst();
    }

    private static boolean isLow(MetricSummary m) {
        return m.status() != null && !"OPTIMAL".equals(m.status()) && !"NORMAL".equals(m.status())
                && m.value() < m.optimalMin();
    }

    private static boolean isHigh(MetricSummary m) {
        return m.status() != null && !"OPTIMAL".equals(m.status()) && !"NORMAL".equals(m.status())
                && m.value() > m.optimalMax();
    }

    private static String range(MetricSummary m) {
        return withUnit(m.optimalMin(), "") + "-" + withUnit(m.optimalMax(), m.unit());
    }

    /** "41%", "28 °C", "6.2" - percent hugs the number, other units are spaced, pH has none. */
    static String withUnit(Double v, String unit) {
        if (unit == null || unit.isEmpty()) return fmt(v);
        return "%".equals(unit) ? fmt(v) + "%" : fmt(v) + " " + unit;
    }

    static String fmt(Double v) {
        if (v == null) return "-";
        if (Math.abs(v) >= 1000) return String.format(Locale.ROOT, "%,.0f", v);
        return v == Math.rint(v) ? String.valueOf(v.longValue()) : String.format(Locale.ROOT, "%.1f", v);
    }

    private static Double round(double v) {
        return Math.round(v * 10) / 10.0;
    }

    private static String capitalise(String s) {
        return s.isEmpty() ? s : Character.toUpperCase(s.charAt(0)) + s.substring(1);
    }
}

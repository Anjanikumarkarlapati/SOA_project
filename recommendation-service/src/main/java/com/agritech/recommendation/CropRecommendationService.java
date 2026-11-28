package com.agritech.recommendation;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;

/** Rule-based, explainable crop ranking over local climate, soil, water and the requested season. */
@Service
public class CropRecommendationService {
    public record Weights(double temperature, double water, double soil, double season, double trendRisk) {
        double total() { return temperature + water + soil + season + trendRisk; }
    }
    public record Context(ClimateStatistics.Summary climate, String soilType, String waterSource, String waterAvailability,
                          String intent, LocalDate targetDate) {}
    public record Recommendation(String cropId, String crop, double score, double temperatureFit,
                                 double waterFit, double soilMatch, double seasonFit,
                                 double climateTrendFit, double expectedWaterNeedMm,
                                 String sowingWindow, String harvestWindow, String riskLevel,
                                 String explanation) {}

    private final Weights weights;
    private final CropReferenceRepository cropReferences;

    @Autowired
    public CropRecommendationService(
            CropReferenceRepository cropReferences,
            @Value("${agritech.recommendation.weights.temperature:0.30}") double temperature,
            @Value("${agritech.recommendation.weights.water:0.25}") double water,
            @Value("${agritech.recommendation.weights.soil:0.15}") double soil,
            @Value("${agritech.recommendation.weights.season:0.15}") double season,
            @Value("${agritech.recommendation.weights.trend-risk:0.15}") double trendRisk) {
        this.cropReferences = cropReferences;
        this.weights = new Weights(temperature, water, soil, season, trendRisk);
        if (weights.total() <= 0 || Math.abs(weights.total() - 1.0) > .001) {
            throw new IllegalArgumentException("Crop recommendation weights must sum to 1.0");
        }
    }

    CropRecommendationService(double temperature, double water, double soil, double season, double trendRisk) {
        this(null, temperature, water, soil, season, trendRisk);
    }

    public List<Recommendation> recommend(Context context, int limit) {
        List<CropReference> catalogue = cropReferences == null
                ? CropCatalog.all().stream().map(CropReference::from).toList()
                : cropReferences.findAll();
        return catalogue.stream().map(crop -> score(crop, context, weights))
                .sorted(Comparator.comparingDouble(Recommendation::score).reversed()
                        .thenComparing(Recommendation::crop))
                .limit(Math.max(1, Math.min(limit, 5))).toList();
    }

    public Weights weights() { return weights; }

    static Recommendation score(CropReference crop, Context context, Weights weights) {
        ClimateStatistics.Summary climate = context.climate();
        double tempFit = fit(climate == null ? null : climate.temperatureC().mean(), crop.temperatureRange());
        double need = crop.getWaterNeedMm();
        double annualRain = climate == null || climate.rainfallMm().mean() == null
                ? 0 : climate.rainfallMm().mean() * 365.2425;
        double accessible = annualRain + waterSupplement(context.waterSource(), context.waterAvailability());
        double waterFit = clamp(accessible / need, 0, 1);
        double soilFit = soilMatch(context.soilType(), crop.getSoilPreference());
        LocalDate sow = context.targetDate() == null ? LocalDate.now() : context.targetDate();
        double seasonFit = seasonFit(crop.getSeasonWindows(), sow.getMonthValue(), context.intent());
        double trendFit = trendFit(climate);
        double raw = (tempFit * weights.temperature() + waterFit * weights.water() + soilFit * weights.soil()
                + seasonFit * weights.season() + trendFit * weights.trendRisk()) / weights.total();
        double score = Math.round(raw * 1000) / 10.0;
        int duration = crop.getDurationDays();
        LocalDate harvestStart = sow.plusDays(Math.max(1, duration - 14));
        LocalDate harvestEnd = sow.plusDays(duration + 14);
        String risk = score >= 75 ? "LOW" : score >= 50 ? "MODERATE" : "HIGH";
        String explanation = explanation(crop, tempFit, waterFit, soilFit, seasonFit, trendFit, climate);
        return new Recommendation(crop.getCropId(), crop.getName(), score, pct(tempFit), pct(waterFit), pct(soilFit),
                pct(seasonFit), pct(trendFit), need, sow.toString(), harvestStart + " to " + harvestEnd,
                risk, explanation);
    }

    static Recommendation score(CropCatalog.Spec crop, Context context, Weights weights) {
        return score(CropReference.from(crop), context, weights);
    }

    private static double fit(Double value, CropCatalog.Range range) {
        if (value == null) return .5;
        if (value >= range.min() && value <= range.max()) return 1;
        double gap = value < range.min() ? range.min() - value : value - range.max();
        return clamp(1 - gap / Math.max(8, range.width()), 0, 1);
    }

    private static double waterSupplement(String source, String availability) {
        double capacity = source == null ? 150 : switch (source.toLowerCase(Locale.ROOT)) {
            case "canal", "river" -> 450;
            case "borewell" -> 350;
            case "rain-fed" -> 0;
            default -> 150;
        };
        double reliability = availability == null ? .7 : switch (availability.toLowerCase(Locale.ROOT)) {
            case "year-round" -> 1;
            case "seasonal" -> .7;
            case "limited" -> .35;
            case "unreliable" -> .2;
            default -> .7;
        };
        return capacity * reliability;
    }

    private static double soilMatch(String soil, String preference) {
        if (soil == null || soil.isBlank()) return .65;
        String normalized = soil.toLowerCase(Locale.ROOT);
        if ("alluvial".equals(normalized)) return .9;
        String normalizedPreference = preference == null ? "" : preference.toLowerCase(Locale.ROOT);
        if ("black".equals(normalized)) return normalizedPreference.contains("black") ? 1 : .7;
        if ("sandy".equals(normalized)) return normalizedPreference.contains("sandy") ? 1 : .6;
        if ("red".equals(normalized) || "laterite".equals(normalized)) {
            return normalizedPreference.contains("red") || normalizedPreference.contains("laterite") ? .95 : .7;
        }
        if ("mountain".equals(normalized)) return normalizedPreference.contains("loam") ? .9 : .6;
        return .65;
    }

    private static double seasonFit(String seasonWindows, int month, String intent) {
        if ("RECOMMEND_BEST".equals(intent)) return 1;
        boolean kharif = month >= 6 && month <= 10;
        if (seasonWindows == null || seasonWindows.contains("PERENNIAL") || seasonWindows.contains("BOTH")) return .95;
        boolean cropKharif = seasonWindows.contains("KHARIF");
        return kharif == cropKharif ? .95 : .55;
    }

    private static double trendFit(ClimateStatistics.Summary climate) {
        if (climate == null) return .6;
        double warmingPenalty = climate.temperatureTrendCPerDecade() == null ? 0
                : Math.max(0, climate.temperatureTrendCPerDecade()) * .025;
        double dryingPenalty = climate.rainfallTrendMmPerDecade() == null ? 0
                : Math.max(0, -climate.rainfallTrendMmPerDecade()) * .0003;
        double droughtPenalty = climate.droughtRiskPercent() == null ? 0 : climate.droughtRiskPercent() / 100 * .35;
        double heatPenalty = climate.heatStressRiskPercent() == null ? 0 : climate.heatStressRiskPercent() / 100 * .35;
        return clamp(1 - warmingPenalty - dryingPenalty - droughtPenalty - heatPenalty, 0, 1);
    }

    private static String explanation(CropReference crop, double temperature, double water, double soil,
                                     double season, double trend, ClimateStatistics.Summary climate) {
        StringBuilder text = new StringBuilder(crop.getName()).append(" fits ");
        if (temperature >= .75) text.append("the historical temperature range");
        else text.append("temperature conditions with some heat or cold risk");
        text.append(" and has ").append(water >= .75 ? "good" : water >= .45 ? "moderate" : "limited")
                .append(" estimated water coverage. ");
        text.append(soil >= .85 ? "The soil type is a good match." : soil >= .65
                ? "Soil compatibility is reasonable." : "Soil compatibility may limit performance.");
        if (season < .7) text.append(" The selected sowing date is outside its common planting window.");
        if (trend < .65) text.append(" Long-term warming or water-stress indicators raise climate risk.");
        if (climate == null || climate.temperatureC().mean() == null) text.append(" Climate data is unavailable, so this is a preliminary score.");
        return text.toString();
    }

    private static double pct(double value) { return Math.round(value * 1000) / 10.0; }
    private static double clamp(double value, double min, double max) { return Math.max(min, Math.min(max, value)); }
}

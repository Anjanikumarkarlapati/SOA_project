package com.agritech.crop;

import java.util.ArrayList;
import java.util.List;

/**
 * Crop health scoring (FR-5, FR-6). Pure function of a reading plus the crop's optimal envelope,
 * so it can be reasoned about and tested without a database or a running sensor service.
 *
 * A metric inside its optimal band scores 100. Outside, it loses points in proportion to how far
 * out it is, measured in "band widths" - drifting half a band out costs half the metric's points.
 */
public final class HealthScore {

    /** Fraction of a band width beyond the optimal range that still counts as a warning. */
    private static final double WARNING_MARGIN = 0.35;

    private static final double MOISTURE_WEIGHT = 0.5;
    private static final double TEMPERATURE_WEIGHT = 0.3;
    private static final double PH_WEIGHT = 0.2;

    private HealthScore() {}

    public record Result(int score, String moistureStatus, String temperatureStatus, String phStatus,
                         Double hoursToIrrigation, List<String> recommendations) {}

    /**
     * @param moistureSlopePerHour recent change in soil moisture per hour; negative means drying.
     *                             Used for the 24-48h irrigation forecast in FR-6.
     */
    public static Result evaluate(Crop crop, double moisture, double temperature, double ph,
                                  double moistureSlopePerHour) {

        double moistureScore = metricScore(moisture, crop.getMoistureMin(), crop.getMoistureMax());
        double tempScore = metricScore(temperature, crop.getTemperatureMin(), crop.getTemperatureMax());
        double phScore = metricScore(ph, crop.getPhMin(), crop.getPhMax());

        int score = (int) Math.round(
                moistureScore * MOISTURE_WEIGHT + tempScore * TEMPERATURE_WEIGHT + phScore * PH_WEIGHT);

        String moistureStatus = status(moisture, crop.getMoistureMin(), crop.getMoistureMax());
        String tempStatus = status(temperature, crop.getTemperatureMin(), crop.getTemperatureMax());
        String phStatus = status(ph, crop.getPhMin(), crop.getPhMax());

        Double hoursToIrrigation = hoursUntilDry(moisture, crop.getMoistureMin(), moistureSlopePerHour);

        return new Result(score, moistureStatus, tempStatus, phStatus, hoursToIrrigation,
                recommend(crop, moisture, temperature, ph, moistureStatus, tempStatus, phStatus, hoursToIrrigation));
    }

    /** 100 inside the band, falling off linearly outside it, floored at 0. */
    private static double metricScore(double value, double min, double max) {
        if (value >= min && value <= max) return 100;
        double band = Math.max(max - min, 0.001);
        double distance = value < min ? min - value : value - max;
        return Math.max(0, 100 - (distance / band) * 100);
    }

    private static String status(double value, double min, double max) {
        if (value >= min && value <= max) return "OPTIMAL";
        double band = Math.max(max - min, 0.001);
        double distance = value < min ? min - value : value - max;
        return distance <= band * WARNING_MARGIN ? "WARNING" : "CRITICAL";
    }

    /**
     * Straight-line projection of when moisture crosses below the optimal floor. Only reports a
     * forecast inside the 48h horizon the PRD asks for; beyond that the extrapolation is noise.
     */
    static Double hoursUntilDry(double moisture, double moistureMin, double slopePerHour) {
        if (slopePerHour >= -0.01) return null;
        if (moisture <= moistureMin) return 0.0;
        double hours = (moisture - moistureMin) / -slopePerHour;
        return hours > 48 ? null : Math.round(hours * 10) / 10.0;
    }

    private static List<String> recommend(Crop crop, double moisture, double temperature, double ph,
                                          String moistureStatus, String tempStatus, String phStatus,
                                          Double hoursToIrrigation) {
        List<String> notes = new ArrayList<>();

        // Deviations first: the dashboard shows notes.get(0) as the alert headline, so it has to
        // name the metric that is actually out of band rather than a forecast.
        if (moisture < crop.getMoistureMin()) {
            notes.add(String.format(
                    "Soil moisture %.1f%% is below the optimal %.0f-%.0f%% band for %s - irrigation recommended.",
                    moisture, crop.getMoistureMin(), crop.getMoistureMax(), crop.getCropType()));
        } else if (moisture > crop.getMoistureMax()) {
            notes.add(String.format(
                    "Soil moisture %.1f%% is above the optimal band - hold irrigation to avoid waterlogging.",
                    moisture));
        }
        if (!"OPTIMAL".equals(tempStatus)) {
            notes.add(String.format("Soil temperature %.1f C is outside the optimal %.0f-%.0f C band.",
                    temperature, crop.getTemperatureMin(), crop.getTemperatureMax()));
        }
        if (!"OPTIMAL".equals(phStatus)) {
            notes.add(String.format("Soil pH %.1f is outside the %.1f-%.1f band - consider amendment.",
                    ph, crop.getPhMin(), crop.getPhMax()));
        }

        if (hoursToIrrigation != null && "OPTIMAL".equals(moistureStatus)) {
            long hours = Math.round(hoursToIrrigation);
            notes.add(String.format("Moisture is trending down; projected to leave the optimal band in about %d %s.",
                    hours, hours == 1 ? "hour" : "hours"));
        }
        if (notes.isEmpty()) {
            notes.add("All metrics within optimal range - maintain the current watering schedule.");
        }
        return notes;
    }
}

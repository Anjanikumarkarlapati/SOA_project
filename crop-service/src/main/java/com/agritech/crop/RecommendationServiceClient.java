package com.agritech.crop;

import com.agritech.common.ApiException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestTemplate;

import java.time.LocalDate;
import java.time.format.DateTimeParseException;
import java.util.LinkedHashMap;
import java.util.Map;

/** Orchestrates climate-service and recommendation-service behind owner-checked property routes. */
@Component
public class RecommendationServiceClient {
    private static final Logger log = LoggerFactory.getLogger(RecommendationServiceClient.class);
    private final RestTemplate rest;
    private final ClimateServiceClient climate;

    public RecommendationServiceClient(RestTemplate rest, ClimateServiceClient climate) {
        this.rest = rest;
        this.climate = climate;
    }

    @SuppressWarnings("unchecked")
    public Map<String, Object> recommend(FarmProperty property, LocalDate start, LocalDate end) {
        if (property.getLatitude() == null || property.getLongitude() == null) {
            throw ApiException.badRequest("This property needs map coordinates before crop recommendations can be loaded");
        }
        LocalDate to = end == null ? LocalDate.now().minusDays(5) : end;
        LocalDate from = start == null ? to.minusYears(10) : start;
        Map<String, Object> climateResult = climate.historical(property.getLatitude(), property.getLongitude(), from, to);
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("climate", climateResult.get("statistics"));
        body.put("soilType", property.getSoilType());
        PropertyWaterDetails water = property.getWaterDetails();
        body.put("waterSource", water == null ? null : water.getWaterSource());
        body.put("waterAvailability", water == null ? null : water.getAvailability());
        PropertyCropIntent cropIntent = property.getCropIntent();
        String intent = cropIntent == null || cropIntent.getIntent() == null ? "GROW_NOW" : cropIntent.getIntent();
        LocalDate targetDate = start;
        if (targetDate == null && "PLAN_DATES".equals(intent) && cropIntent.getStartDate() != null) {
            try { targetDate = LocalDate.parse(cropIntent.getStartDate()); }
            catch (DateTimeParseException e) { throw ApiException.badRequest("Saved crop intent start date is invalid"); }
        }
        body.put("intent", intent);
        body.put("targetDate", targetDate == null ? null : targetDate.toString());
        body.put("limit", 5);
        Map<String, Object> scored;
        try {
            scored = rest.postForObject("http://recommendation-service/api/internal/recommendations/score", body, Map.class);
        } catch (Exception e) {
            log.warn("recommendation-service unavailable for property {}: {}", property.getPropertyId(), e.getMessage());
            throw new ApiException(HttpStatus.SERVICE_UNAVAILABLE, "recommendation_service_unavailable",
                    "Crop recommendations are temporarily unavailable");
        }
        if (scored == null) scored = Map.of("recommendations", java.util.List.of(), "adaptations", java.util.List.of());
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("propertyId", property.getPropertyId());
        result.put("intent", intent);
        result.put("provider", climateResult.get("provider"));
        result.put("fallback", climateResult.get("fallback"));
        result.put("dataAvailable", climateResult.get("dataAvailable"));
        result.put("period", Map.of("start", climateResult.getOrDefault("startDate", from.toString()),
                "end", climateResult.getOrDefault("endDate", to.toString())));
        result.put("weights", scored.get("weights"));
        result.put("climate", climateResult.get("statistics"));
        result.put("recommendations", scored.getOrDefault("recommendations", java.util.List.of()));
        result.put("adaptations", scored.getOrDefault("adaptations", java.util.List.of()));
        return result;
    }
}

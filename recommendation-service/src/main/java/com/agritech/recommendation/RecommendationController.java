package com.agritech.recommendation;

import com.agritech.common.ApiException;
import com.agritech.common.CallerContext;
import com.agritech.common.InternalAuth;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import org.springframework.http.HttpStatus;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.Map;

@RestController
@Validated
@RequestMapping("/api")
public class RecommendationController {
    private final CropRecommendationService recommendations;

    public RecommendationController(CropRecommendationService recommendations) { this.recommendations = recommendations; }

    public record ScoreRequest(ClimateStatistics.Summary climate, String soilType, String waterSource,
                               String waterAvailability, String intent, LocalDate targetDate,
                               @Min(1) @Max(5) Integer limit) {}

    @PostMapping({"/internal/recommendations/score", "/recommendations/score"})
    public Map<String, Object> score(@Valid @RequestBody ScoreRequest request, HttpServletRequest http) {
        String role = CallerContext.role(http);
        if (InternalAuth.SERVICE_ROLE.equals(role)) {
            if (!http.getRequestURI().startsWith("/api/internal/")) {
                throw ApiException.forbidden("Service identity is only allowed on internal recommendation routes");
            }
        } else if (http.getHeader(CallerContext.EMAIL_HEADER) == null || http.getHeader(CallerContext.EMAIL_HEADER).isBlank()) {
            throw new ApiException(HttpStatus.UNAUTHORIZED, "unauthorized", "Sign in to request crop recommendations");
        }
        String intent = request.intent() == null ? "RECOMMEND_BEST" : request.intent();
        if (!java.util.Set.of("GROW_NOW", "PLAN_DATES", "RECOMMEND_BEST").contains(intent)) {
            throw ApiException.badRequest("intent must be GROW_NOW, PLAN_DATES, or RECOMMEND_BEST");
        }
        var context = new CropRecommendationService.Context(request.climate(), request.soilType(), request.waterSource(),
                request.waterAvailability(), intent, request.targetDate());
        var climate = request.climate();
        var ranked = recommendations.recommend(context, request.limit() == null ? 5 : request.limit());
        var adaptations = new ArrayList<String>();
        if (climate != null && climate.heatStressRiskPercent() != null && climate.heatStressRiskPercent() >= 20) {
            adaptations.add("Consider heat-tolerant varieties and shift sowing earlier to avoid peak heat during flowering.");
        }
        if (climate != null && climate.droughtRiskPercent() != null && climate.droughtRiskPercent() >= 20) {
            adaptations.add("Use drought-tolerant varieties, mulch the soil, and plan supplemental irrigation for dry spells.");
        }
        if (climate != null && climate.temperatureTrendCPerDecade() != null && climate.temperatureTrendCPerDecade() >= .2) {
            adaptations.add("Historical temperatures are rising; review sowing dates and varieties each season.");
        }
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("weights", recommendations.weights());
        result.put("recommendations", ranked);
        result.put("adaptations", adaptations);
        return result;
    }
}

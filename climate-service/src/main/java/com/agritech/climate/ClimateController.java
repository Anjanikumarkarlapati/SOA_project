package com.agritech.climate;

import com.agritech.common.ApiException;
import com.agritech.common.CallerContext;
import com.agritech.common.InternalAuth;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDate;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;
import java.util.stream.Collectors;

@RestController
@Validated
@RequestMapping("/api")
public class ClimateController {
    private static final String ATTRIBUTION = "Open-Meteo (open-meteo.com), CC BY 4.0. Model/reanalysis data, not on-farm observations.";
    private final PublicWeatherClient weather;

    public ClimateController(PublicWeatherClient weather) { this.weather = weather; }

    @GetMapping({"/internal/climate/history", "/climate/history"})
    public Map<String, Object> historical(
            @RequestParam @DecimalMin("-90") @DecimalMax("90") double lat,
            @RequestParam @DecimalMin("-180") @DecimalMax("180") double lon,
            @RequestParam @NotNull @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate start,
            @RequestParam @NotNull @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate end,
            HttpServletRequest request) {
        String role = CallerContext.role(request);
        if (InternalAuth.SERVICE_ROLE.equals(role)) {
            if (!request.getRequestURI().startsWith("/api/internal/")) {
                throw ApiException.forbidden("Service identity is only allowed on internal climate routes");
            }
        } else if (request.getHeader(CallerContext.EMAIL_HEADER) == null || request.getHeader(CallerContext.EMAIL_HEADER).isBlank()) {
            throw new ApiException(HttpStatus.UNAUTHORIZED, "unauthorized", "Sign in to request climate analytics");
        }
        var historical = weather.historicalRange(lat, lon, start, end);
        List<ClimateStatistics.Day> days = historical.days();
        ClimateStatistics.Summary summary = ClimateStatistics.summarize(days);
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("provider", "Open-Meteo Historical Weather API");
        result.put("attribution", ATTRIBUTION);
        result.put("startDate", start.toString());
        result.put("endDate", end.toString());
        result.put("fallback", historical.fallback());
        result.put("dataAvailable", !days.isEmpty());
        result.put("dailyObservations", days.size());
        result.put("statistics", summary);
        result.put("annualSeries", days.stream().collect(Collectors.groupingBy(
                day -> day.date().getYear(), TreeMap::new, Collectors.toList()))
                .entrySet().stream().map(entry -> {
                    ClimateStatistics.Summary annual = ClimateStatistics.summarize(entry.getValue());
                    Map<String, Object> row = new LinkedHashMap<>();
                    row.put("year", entry.getKey());
                    row.put("meanTemperatureC", annual.temperatureC().mean());
                    row.put("rainfallTotalMm", annual.rainfallMm().mean() == null ? null
                            : annual.rainfallMm().mean() * annual.rainfallMm().count());
                    row.put("referenceEt0Mm", annual.referenceEvapotranspirationMm());
                    row.put("waterBalanceMm", annual.waterBalanceMm());
                    row.put("growingDegreeDays", annual.growingDegreeDays());
                    return row;
                }).toList());
        return result;
    }
}

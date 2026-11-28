package com.agritech.crop;

import com.agritech.common.ApiException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestTemplate;

import java.time.LocalDate;
import java.util.LinkedHashMap;
import java.util.Map;

/** Service boundary for historical climate retrieval and formula-based climate analytics. */
@Component
public class ClimateServiceClient {
    private static final Logger log = LoggerFactory.getLogger(ClimateServiceClient.class);
    private final RestTemplate rest;

    public ClimateServiceClient(RestTemplate rest) { this.rest = rest; }

    @SuppressWarnings("unchecked")
    public Map<String, Object> historical(double lat, double lon, LocalDate start, LocalDate end) {
        try {
            Map<String, Object> result = rest.getForObject(
                    "http://climate-service/api/internal/climate/history?lat={lat}&lon={lon}&start={start}&end={end}",
                    Map.class, lat, lon, start, end);
            return result == null ? Map.of() : result;
        } catch (Exception e) {
            log.warn("climate-service unavailable for {}, {}, {}..{}: {}", lat, lon, start, end, e.getMessage());
            throw new ApiException(org.springframework.http.HttpStatus.SERVICE_UNAVAILABLE,
                    "climate_service_unavailable", "Climate analytics are temporarily unavailable");
        }
    }
}

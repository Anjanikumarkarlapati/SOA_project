package com.agritech.irrigation;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.HttpMethod;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestTemplate;

import java.util.Map;
import java.util.Optional;

/**
 * FR-9: irrigation -> crop monitoring (should this zone be watered?) and irrigation -> sensor
 * (tell the field its valve just opened). Both hosts are Eureka service ids.
 */
@Component
public class FarmClient {

    private static final Logger log = LoggerFactory.getLogger(FarmClient.class);

    private final RestTemplate rest;

    public FarmClient(RestTemplate rest) { this.rest = rest; }

    /** Current crop health, or empty if crop-service is unreachable. */
    public Optional<Map<String, Object>> cropHealth(String cropId) {
        try {
            Map<String, Object> body = rest.exchange("http://crop-service/api/crops/" + cropId + "/health",
                    HttpMethod.GET, null, new ParameterizedTypeReference<Map<String, Object>>() {}).getBody();
            return Optional.ofNullable(body);
        } catch (Exception e) {
            log.warn("crop-service unavailable for {}: {}", cropId, e.getMessage());
            return Optional.empty();
        }
    }

    /** Best-effort notification so field telemetry reflects the valve state. */
    public void notifyValveState(String cropId, String state, int durationMinutes) {
        try {
            rest.postForObject("http://sensor-service/api/telemetry/field/" + cropId
                    + "/irrigation-event?state=" + state + "&durationMinutes=" + durationMinutes,
                    null, Void.class);
        } catch (Exception e) {
            log.debug("sensor-service irrigation notification failed for {}: {}", cropId, e.getMessage());
        }
    }

    static double moisture(Map<String, Object> health) {
        Object value = health.get("soilMoisture");
        return value instanceof Number n ? n.doubleValue() : Double.NaN;
    }
}

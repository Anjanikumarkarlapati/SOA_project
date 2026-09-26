package com.agritech.crop;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.HttpMethod;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestTemplate;

import java.util.List;
import java.util.Map;

/**
 * FR-9: crop monitoring -> sensor service. The host is a Eureka service id, not a URL, so
 * instances can come and go behind the load balancer.
 *
 * ponytail: failures degrade to empty results rather than tripping a circuit breaker. Add
 * spring-cloud-starter-circuitbreaker-resilience4j here if sensor-service starts failing slowly
 * enough that these timeouts stack up.
 */
@Component
public class SensorClient {

    private static final Logger log = LoggerFactory.getLogger(SensorClient.class);
    private static final String BASE = "http://sensor-service/api/telemetry";

    private final RestTemplate rest;

    public SensorClient(RestTemplate rest) { this.rest = rest; }

    /** Latest averaged reading across every sensor assigned to the field. Empty if unavailable. */
    public Map<String, Object> latestForField(String fieldId) {
        try {
            Map<String, Object> body = rest.exchange(BASE + "/field/" + fieldId + "/latest",
                    HttpMethod.GET, null, new ParameterizedTypeReference<Map<String, Object>>() {}).getBody();
            return body == null ? Map.of() : body;
        } catch (Exception e) {
            log.warn("sensor-service unavailable for field {}: {}", fieldId, e.getMessage());
            return Map.of();
        }
    }

    public List<Map<String, Object>> seriesForField(String fieldId, String range) {
        try {
            List<Map<String, Object>> body = rest.exchange(
                    BASE + "/field/" + fieldId + "/series?range=" + range,
                    HttpMethod.GET, null, new ParameterizedTypeReference<List<Map<String, Object>>>() {}).getBody();
            return body == null ? List.of() : body;
        } catch (Exception e) {
            log.warn("sensor-service series unavailable for field {}: {}", fieldId, e.getMessage());
            return List.of();
        }
    }

    /** Registers one simulated soil sensor on a newly added field. Returns false if sensor-service is down. */
    public boolean provisionSensor(String fieldId, String farmId) {
        try {
            rest.postForObject("http://sensor-service/api/sensors/register", Map.of(
                    "deviceId", "SENSOR-" + fieldId,
                    "farmId", farmId,
                    "sensorType", "soil-moisture-temperature",
                    "fieldId", fieldId), Map.class);
            return true;
        } catch (Exception e) {
            log.warn("could not provision a sensor for field {}: {}", fieldId, e.getMessage());
            return false;
        }
    }

    static double asDouble(Object value, double fallback) {
        return value instanceof Number n ? n.doubleValue() : fallback;
    }
}

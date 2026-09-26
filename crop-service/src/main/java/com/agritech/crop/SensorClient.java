package com.agritech.crop;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.HttpMethod;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestTemplate;

import java.util.List;
import java.util.Map;

/**
 * FR-9: crop monitoring -> sensor service. The host defaults to a Eureka service id, not a URL,
 * so instances can come and go behind the load balancer. A deployment without Eureka overrides
 * it with the service's absolute URL (see application-cloud.yml).
 *
 * ponytail: failures degrade to empty results rather than tripping a circuit breaker. Add
 * spring-cloud-starter-circuitbreaker-resilience4j here if sensor-service starts failing slowly
 * enough that these timeouts stack up.
 */
@Component
public class SensorClient {

    private static final Logger log = LoggerFactory.getLogger(SensorClient.class);

    private final RestTemplate rest;
    private final String base;

    public SensorClient(RestTemplate rest,
                        @Value("${agritech.services.sensor-url:http://sensor-service}") String sensorUrl) {
        this.rest = rest;
        this.base = sensorUrl.replaceAll("/+$", "") + "/api/telemetry";
    }

    /** Latest averaged reading across every sensor assigned to the field. Empty if unavailable. */
    public Map<String, Object> latestForField(String fieldId) {
        try {
            Map<String, Object> body = rest.exchange(base + "/field/" + fieldId + "/latest",
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
                    base + "/field/" + fieldId + "/series?range=" + range,
                    HttpMethod.GET, null, new ParameterizedTypeReference<List<Map<String, Object>>>() {}).getBody();
            return body == null ? List.of() : body;
        } catch (Exception e) {
            log.warn("sensor-service series unavailable for field {}: {}", fieldId, e.getMessage());
            return List.of();
        }
    }

    static double asDouble(Object value, double fallback) {
        return value instanceof Number n ? n.doubleValue() : fallback;
    }
}

package com.agritech.gateway;

import org.springframework.cloud.gateway.route.RouteLocator;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;
import reactor.core.publisher.Mono;

import java.time.Instant;
import java.util.*;

/**
 * Root controller that provides a welcome page and health check for the API Gateway.
 * Replaces the default Whitelabel Error Page when accessing "/" or root paths.
 */
@RestController
public class GatewayHealthController {

    private final RouteLocator routeLocator;

    public GatewayHealthController(RouteLocator routeLocator) {
        this.routeLocator = routeLocator;
    }

    /**
     * Returns a helpful welcome message when accessing the gateway root.
     */
    @GetMapping("/")
    public Mono<Map<String, Object>> root() {
        Map<String, Object> response = new LinkedHashMap<>();
        response.put("name", "AgriTech API Gateway");
        response.put("status", "running");
        response.put("timestamp", Instant.now().toString());
        response.put("version", "1.0.0");
        
        // Available services
        Map<String, String> services = new LinkedHashMap<>();
        services.put("auth-service", "/api/auth/**");
        services.put("sensor-service", "/api/sensors/**, /api/telemetry/**");
        services.put("crop-service", "/api/crops/**");
        services.put("irrigation-service", "/api/irrigation/**, /api/valves/**");
        
        response.put("services", services);
        
        // Public links (no internal topology URLs or admin-only actuator paths)
        Map<String, String> links = new LinkedHashMap<>();
        links.put("health", "/actuator/health");
        
        response.put("links", links);
        
        return Mono.just(response);
    }

    /**
     * Returns gateway status.
     */
    @GetMapping("/status")
    public Mono<Map<String, Object>> status() {
        Map<String, Object> status = new LinkedHashMap<>();
        status.put("gateway", "UP");
        status.put("timestamp", Instant.now().toString());
        
        return Mono.just(status);
    }
}

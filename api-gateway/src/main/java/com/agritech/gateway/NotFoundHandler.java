package com.agritech.gateway;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.io.buffer.DataBuffer;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.server.reactive.ServerHttpResponse;
import org.springframework.web.reactive.function.server.RouterFunction;
import org.springframework.web.reactive.function.server.ServerResponse;
import reactor.core.publisher.Mono;

import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.HashMap;
import java.util.Map;

import static org.springframework.web.reactive.function.server.RequestPredicates.path;
import static org.springframework.web.reactive.function.server.RouterFunctions.route;

/**
 * Handles requests that don't match any configured route.
 * Returns a helpful JSON response instead of the Whitelabel Error Page.
 */
@Configuration
public class NotFoundHandler {

    @Bean
    public RouterFunction<ServerResponse> notFoundRouter() {
        // Only intercept the root path. Any /api/** request that does not match a gateway route is
        // already turned into a friendly JSON 404 by GlobalErrorWebExceptionHandler. Matching "/api/*"
        // (a single segment) here would shadow legitimate collection endpoints such as GET /api/sensors,
        // /api/crops and /api/valves, so it is intentionally removed.
        return route(path("/"),
            request -> {
                ServerHttpResponse response = request.exchange().getResponse();
                response.setStatusCode(HttpStatus.NOT_FOUND);
                response.getHeaders().setContentType(MediaType.APPLICATION_JSON);
                
                Map<String, Object> errorResponse = new HashMap<>();
                errorResponse.put("timestamp", Instant.now().toString());
                errorResponse.put("status", 404);
                errorResponse.put("error", "Not Found");
                errorResponse.put("path", request.path());
                errorResponse.put("message", "No matching route found. Check the path and ensure the target service is running.");
                errorResponse.put("availableEndpoints", getEndpoints());
                errorResponse.put("eurekaDashboard", "http://localhost:8761");
                
                String json = toJson(errorResponse);
                DataBuffer buffer = response.bufferFactory().wrap(json.getBytes(StandardCharsets.UTF_8));
                return response.writeWith(Mono.just(buffer)).then(Mono.empty());
            }
        );
    }

    private Map<String, String> getEndpoints() {
        Map<String, String> endpoints = new HashMap<>();
        endpoints.put("Authentication", "/api/auth/**");
        endpoints.put("Sensors", "/api/sensors/**");
        endpoints.put("Telemetry", "/api/telemetry/**");
        endpoints.put("Crops", "/api/crops/**");
        endpoints.put("Irrigation", "/api/irrigation/**");
        endpoints.put("Valves", "/api/valves/**");
        return endpoints;
    }

    private String toJson(Map<String, Object> map) {
        StringBuilder sb = new StringBuilder("{");
        boolean first = true;
        for (Map.Entry<String, Object> entry : map.entrySet()) {
            if (!first) sb.append(",");
            first = false;
            sb.append("\"").append(entry.getKey()).append("\":");
            Object value = entry.getValue();
            if (value instanceof String) {
                sb.append("\"").append(value).append("\"");
            } else if (value instanceof Map) {
                sb.append(toJsonStringMap((Map<String, String>) value));
            } else {
                sb.append(value);
            }
        }
        sb.append("}");
        return sb.toString();
    }

    private String toJsonStringMap(Map<String, String> map) {
        StringBuilder sb = new StringBuilder("{");
        boolean first = true;
        for (Map.Entry<String, String> entry : map.entrySet()) {
            if (!first) sb.append(",");
            first = false;
            sb.append("\"").append(entry.getKey()).append("\":\"").append(entry.getValue()).append("\"");
        }
        sb.append("}");
        return sb.toString();
    }
}

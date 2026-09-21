package com.agritech.gateway;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.boot.web.reactive.error.ErrorWebExceptionHandler;
import org.springframework.core.annotation.Order;
import org.springframework.core.io.buffer.DataBuffer;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.server.reactive.ServerHttpResponse;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.web.server.ServerWebExchange;
import reactor.core.publisher.Mono;

import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.HashMap;
import java.util.Map;

/**
 * Global error handler that replaces the Whitelabel Error Page with JSON responses.
 * Provides clear, actionable error messages for common gateway scenarios.
 */
@Component
@Order(-1)
public class GlobalErrorWebExceptionHandler implements ErrorWebExceptionHandler {

    private final ObjectMapper mapper = new ObjectMapper();

    @Override
    public Mono<Void> handle(ServerWebExchange exchange, Throwable ex) {
        ServerHttpResponse response = exchange.getResponse();
        
        // Determine HTTP status
        HttpStatus status = determineStatus(ex);
        
        // Build error response
        Map<String, Object> errorResponse = buildErrorResponse(exchange, ex, status);
        
        // Set response headers
        response.setStatusCode(status);
        response.getHeaders().setContentType(MediaType.APPLICATION_JSON);
        
        // Write JSON response
        try {
            String json = mapper.writeValueAsString(errorResponse);
            DataBuffer buffer = response.bufferFactory().wrap(json.getBytes(StandardCharsets.UTF_8));
            return response.writeWith(Mono.just(buffer));
        } catch (JsonProcessingException e) {
            // Fallback to simple text if JSON serialization fails
            String fallback = "{\"error\":\"Internal server error\",\"status\":500}";
            DataBuffer buffer = response.bufferFactory().wrap(fallback.getBytes(StandardCharsets.UTF_8));
            return response.writeWith(Mono.just(buffer));
        }
    }

    private HttpStatus determineStatus(Throwable ex) {
        if (ex instanceof ResponseStatusException rse) {
            return HttpStatus.valueOf(rse.getStatusCode().value());
        }
        return HttpStatus.INTERNAL_SERVER_ERROR;
    }

    private Map<String, Object> buildErrorResponse(ServerWebExchange exchange, Throwable ex, HttpStatus status) {
        Map<String, Object> response = new HashMap<>();
        response.put("timestamp", Instant.now().toString());
        response.put("status", status.value());
        response.put("error", status.getReasonPhrase());
        response.put("path", exchange.getRequest().getPath().value());
        response.put("requestId", exchange.getRequest().getId());
        
        // Provide helpful messages based on error type
        String message = determineMessage(ex, exchange);
        response.put("message", message);
        
        // Add available endpoints hint for 404 errors
        if (status == HttpStatus.NOT_FOUND) {
            response.put("availableEndpoints", getAvailableEndpoints());
            response.put("hint", "Check if the service is registered in Eureka at http://localhost:8761");
        }
        
        return response;
    }

    private String determineMessage(Throwable ex, ServerWebExchange exchange) {
        String path = exchange.getRequest().getPath().value();
        
        // Root path hint
        if (path.equals("/") || path.isEmpty()) {
            return "API Gateway is running. Use /api/auth, /api/sensors, /api/crops, or /api/irrigation endpoints.";
        }
        
        // Service unavailable (no instances in Eureka)
        if (ex.getMessage() != null && ex.getMessage().contains("Unable to find instance")) {
            return "Service not available. Ensure the target service is running and registered with Eureka.";
        }
        
        // Connection refused
        if (ex.getMessage() != null && ex.getMessage().contains("Connection refused")) {
            return "Could not connect to backend service. Verify the service is healthy in Eureka.";
        }
        
        // Generic 404
        if (ex instanceof ResponseStatusException rse && rse.getStatusCode().value() == 404) {
            return "No route found for " + path + ". Check if the path matches a configured route.";
        }
        
        // Fallback
        return ex.getMessage() != null ? ex.getMessage() : "An unexpected error occurred";
    }

    private Map<String, String> getAvailableEndpoints() {
        Map<String, String> endpoints = new HashMap<>();
        endpoints.put("Authentication", "/api/auth/**");
        endpoints.put("Sensors", "/api/sensors/**");
        endpoints.put("Telemetry", "/api/telemetry/**");
        endpoints.put("Crops", "/api/crops/**");
        endpoints.put("Irrigation", "/api/irrigation/**");
        endpoints.put("Valves", "/api/valves/**");
        return endpoints;
    }
}

package com.agritech.gateway;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;
import java.util.Map;

/**
 * Circuit-breaker fallback: when a service is down or its breaker is open, callers get a fast,
 * well-formed 503 in the PRD 7.3 envelope instead of a hung connection or a raw stack trace.
 */
@RestController
public class FallbackController {

    @RequestMapping("/fallback/{service}")
    public ResponseEntity<Map<String, String>> fallback(@PathVariable String service) {
        return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
                .header("Retry-After", "10")
                .body(Map.of(
                        "error", "service_unavailable",
                        "message", service + " is temporarily unavailable; please retry shortly",
                        "service", service,
                        "timestamp", Instant.now().toString()));
    }
}

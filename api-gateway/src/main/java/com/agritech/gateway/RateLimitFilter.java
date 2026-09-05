package com.agritech.gateway;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.cloud.gateway.filter.GatewayFilterChain;
import org.springframework.cloud.gateway.filter.GlobalFilter;
import org.springframework.core.Ordered;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ServerWebExchange;
import reactor.core.publisher.Mono;

import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;

/**
 * Fixed-window rate limiting per PRD 7.2: public traffic by IP, authenticated traffic by user,
 * device telemetry by device id.
 *
 * ponytail: counters are per-instance and in-memory, so N gateway replicas allow N times the
 * quota. That is the right trade for a single-gateway deployment; swap in
 * spring-cloud-gateway's Redis rate limiter when the gateway is scaled out.
 */
@Component
public class RateLimitFilter implements GlobalFilter, Ordered {

    private record Window(AtomicInteger count, long startedAtMinute) {}

    private final Map<String, Window> windows = new ConcurrentHashMap<>();

    private final int publicLimit;
    private final int authenticatedLimit;
    private final int deviceLimit;

    public RateLimitFilter(@Value("${agritech.rate-limit.public-per-minute:100}") int publicLimit,
                           @Value("${agritech.rate-limit.authenticated-per-minute:1000}") int authenticatedLimit,
                           @Value("${agritech.rate-limit.device-per-minute:100}") int deviceLimit) {
        this.publicLimit = publicLimit;
        this.authenticatedLimit = authenticatedLimit;
        this.deviceLimit = deviceLimit;
    }

    /** After JwtAuthFilter, so the authenticated user is known and quotas are per-user. */
    @Override
    public int getOrder() {
        return -50;
    }

    @Override
    public Mono<Void> filter(ServerWebExchange exchange, GatewayFilterChain chain) {
        String deviceId = exchange.getRequest().getHeaders().getFirst("X-Device-Id");
        String user = exchange.getRequest().getHeaders().getFirst("X-User-Email");

        String bucket;
        int limit;
        if (deviceId != null) {
            bucket = "device:" + deviceId;
            limit = deviceLimit;
        } else if (user != null) {
            bucket = "user:" + user;
            limit = authenticatedLimit;
        } else {
            bucket = "ip:" + clientIp(exchange);
            limit = publicLimit;
        }

        int used = hit(bucket);
        exchange.getResponse().getHeaders().add("X-RateLimit-Limit", String.valueOf(limit));
        exchange.getResponse().getHeaders().add("X-RateLimit-Remaining", String.valueOf(Math.max(0, limit - used)));

        if (used > limit) {
            return GatewayResponses.reject(exchange.getResponse(), HttpStatus.TOO_MANY_REQUESTS,
                    "rate_limit_exceeded", "Rate limit of " + limit + " requests/minute exceeded");
        }
        return chain.filter(exchange);
    }

    /** Returns the request count in the current minute for this bucket. */
    private int hit(String bucket) {
        long minute = System.currentTimeMillis() / 60_000;
        Window window = windows.compute(bucket, (key, existing) ->
                existing == null || existing.startedAtMinute() != minute
                        ? new Window(new AtomicInteger(0), minute)
                        : existing);
        return window.count().incrementAndGet();
    }

    private static String clientIp(ServerWebExchange exchange) {
        String forwarded = exchange.getRequest().getHeaders().getFirst("X-Forwarded-For");
        if (forwarded != null && !forwarded.isBlank()) return forwarded.split(",")[0].trim();
        return exchange.getRequest().getRemoteAddress() == null
                ? "unknown"
                : exchange.getRequest().getRemoteAddress().getAddress().getHostAddress();
    }

    /** Keeps the map from growing without bound as clients and devices come and go. */
    @org.springframework.scheduling.annotation.Scheduled(fixedRate = 300_000)
    void evictStaleWindows() {
        long minute = System.currentTimeMillis() / 60_000;
        windows.values().removeIf(w -> w.startedAtMinute() < minute - 1);
    }
}

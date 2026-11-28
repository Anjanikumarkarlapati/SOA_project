package com.agritech.gateway;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.cloud.gateway.filter.GatewayFilterChain;
import org.springframework.cloud.gateway.filter.GlobalFilter;
import org.springframework.core.Ordered;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ServerWebExchange;
import reactor.core.publisher.Mono;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;

/**
 * Fixed-window rate limiting per PRD 7.2: public traffic by IP, authenticated traffic by user,
 * device telemetry by device id.
 *
 * <p>Every applicable bucket is charged and the <em>strictest</em> one wins. The previous version
 * picked exactly one bucket with if/else-if precedence, which broke in two ways:
 * <ul>
 *   <li>the gateway forwards an empty-but-present {@code X-User-Email} for anonymous calls, so
 *       every unauthenticated visitor landed in a single shared {@code user:} bucket at the 1000/min
 *       authenticated quota - the 100/min public limit never fired, and one client could exhaust
 *       the shared bucket for everyone;</li>
 *   <li>anyone could jump buckets by adding or rotating a client-controlled {@code X-Device-Id},
 *       minting a fresh 100/min allowance per value.</li>
 * </ul>
 * Charging all buckets means a caller must stay inside their IP, user and device allowance at the
 * same time, so no header can be used to escape a limit.
 *
 * <p>{@code X-Forwarded-For} is only trusted behind a proxy that overwrites it
 * ({@code agritech.rate-limit.trust-forwarded-for=true}); otherwise the socket address is used,
 * because a spoofable header is worse than no header for an IP-keyed limit.
 *
 * <p>ponytail: counters are per-instance and in-memory, so N gateway replicas allow N times the
 * quota. That is the right trade for a single-gateway deployment; swap in
 * spring-cloud-gateway's Redis rate limiter when the gateway is scaled out.
 */
@Component
public class RateLimitFilter implements GlobalFilter, Ordered {

    private record Window(AtomicInteger count, long startedAtMinute) {}

    private record Bucket(String key, int limit) {}

    /** A bucket after this request has been counted against it. */
    private record Charged(Bucket bucket, int hits) {}

    private final Map<String, Window> windows = new ConcurrentHashMap<>();

    private final int publicLimit;
    private final int authenticatedLimit;
    private final int deviceLimit;
    private final boolean trustForwardedFor;

    public RateLimitFilter(@Value("${agritech.rate-limit.public-per-minute:100}") int publicLimit,
                           @Value("${agritech.rate-limit.authenticated-per-minute:1000}") int authenticatedLimit,
                           @Value("${agritech.rate-limit.device-per-minute:100}") int deviceLimit,
                           @Value("${agritech.rate-limit.trust-forwarded-for:false}") boolean trustForwardedFor) {
        this.publicLimit = publicLimit;
        this.authenticatedLimit = authenticatedLimit;
        this.deviceLimit = deviceLimit;
        this.trustForwardedFor = trustForwardedFor;
    }

    /** After JwtAuthFilter, so the authenticated user is known and quotas are per-user. */
    @Override
    public int getOrder() {
        return -50;
    }

    @Override
    public Mono<Void> filter(ServerWebExchange exchange, GatewayFilterChain chain) {
        // Read identity from the headers JwtAuthFilter just stripped and re-signed, so a client
        // cannot name its own bucket. Blank means anonymous.
        String user = nonBlank(exchange.getRequest().getHeaders().getFirst("X-User-Email"));
        String deviceId = nonBlank(exchange.getRequest().getHeaders().getFirst("X-Device-Id"));

        List<Bucket> buckets = new ArrayList<>(3);
        buckets.add(new Bucket("ip:" + clientIp(exchange), publicLimit));
        if (user != null) {
            buckets.add(new Bucket("user:" + user, authenticatedLimit));
        }
        if (deviceId != null) {
            String safeDeviceId = deviceId.length() <= 64 && deviceId.matches("[A-Za-z0-9._:-]+")
                    ? deviceId : "_invalid";
            // Scoped to the caller: a shared device id across tenants cannot pool one quota, and
            // arbitrary/oversized header values cannot inflate the window map.
            buckets.add(new Bucket("device:" + safeDeviceId + ":" + (user == null ? "anon" : user), deviceLimit));
        }

        List<Charged> charged = new ArrayList<>(buckets.size());
        for (Bucket bucket : buckets) {
            charged.add(new Charged(bucket, hit(bucket.key())));
        }
        for (Charged charge : charged) {
            if (charge.hits() > charge.bucket().limit()) {
                return GatewayResponses.reject(exchange.getResponse(), HttpStatus.TOO_MANY_REQUESTS,
                        "rate_limit_exceeded",
                        "Rate limit of " + charge.bucket().limit() + " requests/minute exceeded");
            }
        }

        // Advertise the quota the caller is closest to exhausting, which is the strictest one.
        Charged strictest = charged.stream()
                .min(java.util.Comparator.comparingInt(c -> c.bucket().limit()))
                .orElseThrow();
        exchange.getResponse().getHeaders().add("X-RateLimit-Limit", String.valueOf(strictest.bucket().limit()));
        exchange.getResponse().getHeaders().add("X-RateLimit-Remaining",
                String.valueOf(Math.max(0, strictest.bucket().limit() - strictest.hits())));
        exchange.getAttributes().put("rateLimitBucket", strictest.bucket().key());
        return chain.filter(exchange);
    }

    /** Returns the request count in the current minute for this bucket. */
    private int hit(String bucket) {
        if (windows.size() >= 20_000) {
            evictStaleWindows();
        }
        long minute = System.currentTimeMillis() / 60_000;
        Window window = windows.compute(bucket, (key, existing) ->
                existing == null || existing.startedAtMinute() != minute
                        ? new Window(new AtomicInteger(0), minute)
                        : existing);
        return window.count().incrementAndGet();
    }

    private static String nonBlank(String value) {
        return value == null || value.isBlank() ? null : value;
    }

    private String clientIp(ServerWebExchange exchange) {
        if (trustForwardedFor) {
            String forwarded = exchange.getRequest().getHeaders().getFirst("X-Forwarded-For");
            if (forwarded != null && !forwarded.isBlank()) return forwarded.split(",")[0].trim();
        }
        return exchange.getRequest().getRemoteAddress() == null
                ? "unknown"
                : exchange.getRequest().getRemoteAddress().getAddress().getHostAddress();
    }

    /** Keeps the map from growing without bound as clients and devices come and go. */
    @org.springframework.scheduling.annotation.Scheduled(fixedRate = 60_000)
    void evictStaleWindows() {
        long minute = System.currentTimeMillis() / 60_000;
        windows.values().removeIf(w -> w.startedAtMinute() < minute - 1);
    }
}

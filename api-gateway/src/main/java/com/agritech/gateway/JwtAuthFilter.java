package com.agritech.gateway;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.cloud.gateway.filter.GatewayFilterChain;
import org.springframework.cloud.gateway.filter.GlobalFilter;
import org.springframework.core.Ordered;
import org.springframework.http.HttpStatus;
import org.springframework.http.server.reactive.ServerHttpRequest;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ServerWebExchange;
import reactor.core.publisher.Mono;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Set;

/**
 * The single place JWTs are checked (PRD 7.1). Downstream services never see the token - they see
 * the identity headers this filter sets, and any client-supplied copy of those headers is stripped
 * first so a caller cannot forge a role.
 */
@Component
public class JwtAuthFilter implements GlobalFilter, Ordered {

    private static final Logger audit = LoggerFactory.getLogger("AUDIT");

    /** Paths that must work without a token. */
    private static final List<String> PUBLIC_PATHS = List.of(
            "/api/auth/login", "/api/auth/register", "/api/auth/refresh", "/api/auth/google",
            "/actuator/health");

    private final SecretKey key;
    private final RevocationCache revocations;

    public JwtAuthFilter(@Value("${agritech.jwt.secret}") String secret, RevocationCache revocations) {
        this.key = Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8));
        this.revocations = revocations;
    }

    @Override
    public int getOrder() {
        return -100;
    }

    @Override
    public Mono<Void> filter(ServerWebExchange exchange, GatewayFilterChain chain) {
        ServerHttpRequest request = exchange.getRequest();
        String path = request.getPath().value();

        if (request.getMethod().name().equals("OPTIONS") || isPublic(path)) {
            return chain.filter(exchange);
        }

        String header = request.getHeaders().getFirst("Authorization");
        if (header == null || !header.startsWith("Bearer ")) {
            return GatewayResponses.reject(exchange.getResponse(), HttpStatus.UNAUTHORIZED,
                    "unauthorized", "Missing or malformed Authorization header");
        }

        Claims claims;
        try {
            claims = Jwts.parserBuilder().setSigningKey(key).build()
                    .parseClaimsJws(header.substring(7)).getBody();
        } catch (JwtException | IllegalArgumentException e) {
            audit.warn("auth REJECTED path={} reason={}", path, e.getClass().getSimpleName());
            return GatewayResponses.reject(exchange.getResponse(), HttpStatus.UNAUTHORIZED,
                    "invalid_token", "Token is invalid or has expired");
        }

        if (revocations.isRevoked(claims.getId())) {
            return GatewayResponses.reject(exchange.getResponse(), HttpStatus.UNAUTHORIZED,
                    "token_revoked", "This session has been logged out");
        }

        ServerHttpRequest forwarded = request.mutate()
                .headers(h -> IDENTITY_HEADERS.forEach(h::remove))
                .header("X-User-Email", claims.getSubject())
                .header("X-User-Role", String.valueOf(claims.get("role")))
                .header("X-Farm-Id", String.valueOf(claims.get("farmId")))
                .build();

        return chain.filter(exchange.mutate().request(forwarded).build());
    }

    private static final Set<String> IDENTITY_HEADERS = Set.of("X-User-Email", "X-User-Role", "X-Farm-Id");

    private static boolean isPublic(String path) {
        return PUBLIC_PATHS.stream().anyMatch(path::startsWith);
    }
}

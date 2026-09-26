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
import java.util.Set;

/**
 * The single place JWTs are checked (PRD 7.1). Downstream services never see the token - they see
 * the identity headers this filter sets, and any client-supplied copy of those headers is stripped
 * first so a caller cannot forge a role.
 */
@Component
public class JwtAuthFilter implements GlobalFilter, Ordered {

    private static final Logger audit = LoggerFactory.getLogger("AUDIT");

    /** Paths that must work without a token. Exact matches, so "/api/auth/loginX" is not public. */
    static final Set<String> PUBLIC_PATHS = Set.of(
            "/api/auth/login", "/api/auth/register", "/api/auth/refresh", "/api/auth/google",
            "/actuator/health", "/fallback", "/swagger-ui.html",
            "/auth-service/v3/api-docs", "/sensor-service/v3/api-docs",
            "/crop-service/v3/api-docs", "/irrigation-service/v3/api-docs");

    private final SecretKey key;
    private final RevocationCache revocations;
    private final GatewaySigner signer;

    public JwtAuthFilter(@Value("${agritech.jwt.secret}") String secret, RevocationCache revocations,
                         GatewaySigner signer) {
        this.key = Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8));
        this.revocations = revocations;
        this.signer = signer;
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
            // Still strip and re-sign: a client must never smuggle its own identity headers through.
            return chain.filter(exchange.mutate().request(forward(request, "", "ANONYMOUS", "")).build());
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

        ServerHttpRequest forwarded = forward(request, claims.getSubject(),
                String.valueOf(claims.get("role")), String.valueOf(claims.get("farmId")));
        return chain.filter(exchange.mutate().request(forwarded).build());
    }

    static final Set<String> IDENTITY_HEADERS = Set.of("X-User-Email", "X-User-Role", "X-Farm-Id",
            GatewaySigner.SIGNATURE_HEADER, GatewaySigner.TIMESTAMP_HEADER);

    private ServerHttpRequest forward(ServerHttpRequest request, String email, String role, String farmId) {
        return request.mutate().headers(h -> {
            IDENTITY_HEADERS.forEach(h::remove);
            signer.apply(h, email, role, farmId);
        }).build();
    }

    static boolean isPublic(String path) {
        return PUBLIC_PATHS.contains(path) || path.startsWith("/fallback/")
                || path.startsWith("/swagger-ui/") || path.startsWith("/webjars/")
                || path.startsWith("/v3/api-docs");
    }
}

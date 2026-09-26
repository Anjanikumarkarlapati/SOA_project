package com.agritech.gateway;

import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.SignatureAlgorithm;
import io.jsonwebtoken.security.Keys;
import org.junit.jupiter.api.Test;
import org.springframework.cloud.gateway.filter.GatewayFilterChain;
import org.springframework.http.HttpStatus;
import org.springframework.http.server.reactive.ServerHttpRequest;
import org.springframework.mock.http.server.reactive.MockServerHttpRequest;
import org.springframework.mock.web.server.MockServerWebExchange;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.core.publisher.Mono;

import java.nio.charset.StandardCharsets;
import java.util.Date;
import java.util.concurrent.atomic.AtomicReference;

import static org.junit.jupiter.api.Assertions.*;

/** FR-1 at the edge: what the gateway accepts, rejects, and forwards. */
class JwtAuthFilterTest {

    private static final String SECRET = "test-secret-key-that-is-at-least-32-bytes-long!!";
    private final GatewaySigner signer = new GatewaySigner("internal-test-secret");
    private boolean revokeAll;
    private final RevocationCache revocations = new RevocationCache(WebClient.builder(), signer) {
        @Override
        public boolean isRevoked(String jti) { return revokeAll; }
    };
    private final JwtAuthFilter filter = new JwtAuthFilter(SECRET, revocations, signer);

    /** Runs the filter; returns the request forwarded downstream, or null if it was rejected. */
    private ServerHttpRequest run(MockServerWebExchange exchange) {
        AtomicReference<ServerHttpRequest> forwarded = new AtomicReference<>();
        GatewayFilterChain chain = ex -> {
            forwarded.set(ex.getRequest());
            return Mono.empty();
        };
        filter.filter(exchange, chain).block();
        return forwarded.get();
    }

    private static String token(String secret, String jti, long ttlMs) {
        return Jwts.builder().setId(jti).setSubject("admin@agritech.io")
                .claim("role", "ADMIN").claim("farmId", "FARM-001")
                .setExpiration(new Date(System.currentTimeMillis() + ttlMs))
                .signWith(Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8)), SignatureAlgorithm.HS256)
                .compact();
    }

    private static MockServerWebExchange get(String path, String bearer) {
        MockServerHttpRequest.BaseBuilder<?> b = MockServerHttpRequest.get(path);
        if (bearer != null) b.header("Authorization", "Bearer " + bearer);
        return MockServerWebExchange.from(b);
    }

    @Test
    void validTokenIsForwardedWithSignedIdentity() {
        ServerHttpRequest out = run(get("/api/sensors", token(SECRET, "j1", 60_000)));
        assertNotNull(out);
        assertEquals("admin@agritech.io", out.getHeaders().getFirst("X-User-Email"));
        assertEquals("ADMIN", out.getHeaders().getFirst("X-User-Role"));
        long ts = Long.parseLong(out.getHeaders().getFirst(GatewaySigner.TIMESTAMP_HEADER));
        assertEquals(signer.sign("admin@agritech.io", "ADMIN", "FARM-001", ts),
                out.getHeaders().getFirst(GatewaySigner.SIGNATURE_HEADER));
    }

    @Test
    void missingTokenIsRejected() {
        MockServerWebExchange ex = get("/api/sensors", null);
        assertNull(run(ex));
        assertEquals(HttpStatus.UNAUTHORIZED, ex.getResponse().getStatusCode());
    }

    @Test
    void tokenSignedWithAnotherKeyIsRejected() {
        MockServerWebExchange ex = get("/api/sensors", token("attacker-secret-key-that-is-32-bytes-long!!!!", "j2", 60_000));
        assertNull(run(ex));
        assertEquals(HttpStatus.UNAUTHORIZED, ex.getResponse().getStatusCode());
    }

    @Test
    void expiredTokenIsRejected() {
        MockServerWebExchange ex = get("/api/sensors", token(SECRET, "j3", -1_000));
        assertNull(run(ex));
        assertEquals(HttpStatus.UNAUTHORIZED, ex.getResponse().getStatusCode());
    }

    @Test
    void unsignedAlgNoneTokenIsRejected() {
        String none = Jwts.builder().setSubject("admin@agritech.io").claim("role", "ADMIN").compact();
        MockServerWebExchange ex = get("/api/sensors", none);
        assertNull(run(ex));
        assertEquals(HttpStatus.UNAUTHORIZED, ex.getResponse().getStatusCode());
    }

    @Test
    void revokedTokenIsRejected() {
        revokeAll = true;
        MockServerWebExchange ex = get("/api/sensors", token(SECRET, "j4", 60_000));
        assertNull(run(ex));
        assertEquals(HttpStatus.UNAUTHORIZED, ex.getResponse().getStatusCode());
    }

    @Test
    void clientSuppliedIdentityHeadersAreReplaced() {
        MockServerWebExchange ex = MockServerWebExchange.from(MockServerHttpRequest.post("/api/auth/login")
                .header("X-User-Role", "ADMIN").header("X-Gateway-Signature", "forged"));
        ServerHttpRequest out = run(ex);
        assertEquals("ANONYMOUS", out.getHeaders().getFirst("X-User-Role"));
        assertNotEquals("forged", out.getHeaders().getFirst(GatewaySigner.SIGNATURE_HEADER));
    }

    @Test
    void publicPathsAreExactMatches() {
        assertTrue(JwtAuthFilter.isPublic("/api/auth/login"));
        assertFalse(JwtAuthFilter.isPublic("/api/auth/loginX"));
        assertFalse(JwtAuthFilter.isPublic("/api/auth/me"));
        assertFalse(JwtAuthFilter.isPublic("/actuator/gateway/routes"));
    }
}

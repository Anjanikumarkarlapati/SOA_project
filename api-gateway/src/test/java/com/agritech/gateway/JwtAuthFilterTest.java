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
    /** Must satisfy GatewaySecrets.require: >= 32 chars and not a published default. */
    private final GatewaySigner signer = new GatewaySigner("internal-test-secret-value-at-least-32-chars");
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
        assertTrue(JwtAuthFilter.isPublic("/sensor-service/v3/api-docs"));
        assertTrue(JwtAuthFilter.isPublic("/v3/api-docs/swagger-config"));
        assertFalse(JwtAuthFilter.isPublic("/api/auth/loginX"));
        assertFalse(JwtAuthFilter.isPublic("/api/auth/me"));
        assertFalse(JwtAuthFilter.isPublic("/actuator/gateway/routes"));
        assertFalse(JwtAuthFilter.isPublic("/api/sensors/v3/api-docs"));
        assertFalse(JwtAuthFilter.isPublic("/api/crops/v3/api-docs"));
        assertFalse(JwtAuthFilter.isPublic("/api/sensors/v3/api-docs/../../sensors"));
    }

    @Test
    void pathTraversalAndV3ApiDocsBypassAreRejectedAtGateway() {
        MockServerWebExchange docsBypass = get("/api/sensors/v3/api-docs", null);
        assertNull(run(docsBypass));
        assertEquals(HttpStatus.UNAUTHORIZED, docsBypass.getResponse().getStatusCode());

        MockServerWebExchange traversal = get("/api/sensors/v3/api-docs/../../sensors", null);
        assertNull(run(traversal));
        assertEquals(HttpStatus.BAD_REQUEST, traversal.getResponse().getStatusCode());
    }

    @Test
    void actuatorFilterBlocksUnauthenticatedAndFarmerAndAllowsAdminAndHealth() {
        ActuatorAuthWebFilter actuatorFilter = new ActuatorAuthWebFilter(filter);
        org.springframework.web.server.WebFilterChain passChain = ex -> Mono.empty();

        MockServerWebExchange health = MockServerWebExchange.from(MockServerHttpRequest.get("/actuator/health"));
        actuatorFilter.filter(health, passChain).block();
        assertNull(health.getResponse().getStatusCode());

        MockServerWebExchange unauth = MockServerWebExchange.from(MockServerHttpRequest.get("/actuator/circuitbreakers"));
        actuatorFilter.filter(unauth, passChain).block();
        assertEquals(HttpStatus.UNAUTHORIZED, unauth.getResponse().getStatusCode());

        String farmerJwt = Jwts.builder().setId("jf").setSubject("f@agritech.io")
                .claim("role", "FARMER").claim("farmId", "FARM-002")
                .setExpiration(new Date(System.currentTimeMillis() + 60_000))
                .signWith(Keys.hmacShaKeyFor(SECRET.getBytes(StandardCharsets.UTF_8)), SignatureAlgorithm.HS256)
                .compact();
        MockServerWebExchange farmer = MockServerWebExchange.from(MockServerHttpRequest.get("/actuator/circuitbreakers")
                .header("Authorization", "Bearer " + farmerJwt));
        actuatorFilter.filter(farmer, passChain).block();
        assertEquals(HttpStatus.FORBIDDEN, farmer.getResponse().getStatusCode());

        MockServerWebExchange admin = MockServerWebExchange.from(MockServerHttpRequest.get("/actuator/circuitbreakers")
                .header("Authorization", "Bearer " + token(SECRET, "ja", 60_000)));
        actuatorFilter.filter(admin, passChain).block();
        assertNull(admin.getResponse().getStatusCode());
    }
}

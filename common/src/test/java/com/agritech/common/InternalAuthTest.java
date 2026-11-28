package com.agritech.common;

import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockFilterChain;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;

import static org.junit.jupiter.api.Assertions.*;

/** Services must only trust identity headers that the gateway (or a peer service) signed. */
class InternalAuthTest {

    /** Must be at least {@link Secrets#MIN_LENGTH}: a short key is refused at construction. */
    private static final String SECRET = "internal-test-secret-value-at-least-32-chars";

    private final InternalAuth auth = new InternalAuth(SECRET);

    private MockHttpServletResponse call(String role, String signature, long ts) throws Exception {
        MockHttpServletRequest req = new MockHttpServletRequest("GET", "/api/sensors");
        req.addHeader("X-User-Email", "admin@agritech.io");
        req.addHeader("X-User-Role", role);
        req.addHeader("X-Farm-Id", "FARM-001");
        req.addHeader(InternalAuth.TIMESTAMP_HEADER, Long.toString(ts));
        if (signature != null) req.addHeader(InternalAuth.SIGNATURE_HEADER, signature);
        MockHttpServletResponse res = new MockHttpServletResponse();
        auth.doFilter(req, res, new MockFilterChain());
        return res;
    }

    @Test
    void gatewaySignedRequestPasses() throws Exception {
        long now = System.currentTimeMillis();
        assertEquals(200, call("ADMIN", auth.sign("admin@agritech.io", "ADMIN", "FARM-001", now), now).getStatus());
    }

    @Test
    void unsignedDirectCallIsRejected() throws Exception {
        assertEquals(401, call("ADMIN", null, System.currentTimeMillis()).getStatus());
    }

    @Test
    void roleEscalationBreaksTheSignature() throws Exception {
        long now = System.currentTimeMillis();
        String farmerSig = auth.sign("admin@agritech.io", "FARMER", "FARM-001", now);
        assertEquals(401, call("ADMIN", farmerSig, now).getStatus());
    }

    @Test
    void farmSwapBreaksTheSignature() throws Exception {
        // Same user and role, pointed at a different tenant: the signature must not survive it.
        long now = System.currentTimeMillis();
        String otherFarm = auth.sign("admin@agritech.io", "FARMER", "FARM-999", now);
        assertEquals(401, call("FARMER", otherFarm, now).getStatus());
    }

    @Test
    void replayedOldSignatureIsRejected() throws Exception {
        long old = System.currentTimeMillis() - InternalAuth.MAX_SKEW_MS - 1_000;
        assertEquals(401, call("ADMIN", auth.sign("admin@agritech.io", "ADMIN", "FARM-001", old), old).getStatus());
    }

    @Test
    void signatureFromAnotherSecretIsRejected() throws Exception {
        long now = System.currentTimeMillis();
        String other = new InternalAuth("a-completely-different-secret-value-32chars")
                .sign("admin@agritech.io", "ADMIN", "FARM-001", now);
        assertEquals(401, call("ADMIN", other, now).getStatus());
    }

    @Test
    void actuatorIsNotFiltered() throws Exception {
        MockHttpServletRequest req = new MockHttpServletRequest("GET", "/actuator/health");
        assertTrue(auth.shouldNotFilter(req));
    }

    /** The published development default must never be loadable again, even if it is still set. */
    @Test
    void publishedDefaultSecretRefusesToStart() {
        assertThrows(IllegalStateException.class,
                () -> new InternalAuth("agritech-internal-dev-secret-change-me-0123456789"));
    }

    @Test
    void missingSecretRefusesToStart() {
        assertThrows(IllegalStateException.class, () -> new InternalAuth(""));
        assertThrows(IllegalStateException.class, () -> new InternalAuth(null));
    }

    @Test
    void tooShortSecretRefusesToStart() {
        assertThrows(IllegalStateException.class, () -> new InternalAuth("too-short"));
    }
}

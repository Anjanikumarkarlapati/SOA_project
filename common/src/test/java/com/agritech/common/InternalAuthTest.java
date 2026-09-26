package com.agritech.common;

import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockFilterChain;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;

import static org.junit.jupiter.api.Assertions.*;

/** Services must only trust identity headers that the gateway (or a peer service) signed. */
class InternalAuthTest {

    private final InternalAuth auth = new InternalAuth("internal-test-secret");

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
    void replayedOldSignatureIsRejected() throws Exception {
        long old = System.currentTimeMillis() - InternalAuth.MAX_SKEW_MS - 1_000;
        assertEquals(401, call("ADMIN", auth.sign("admin@agritech.io", "ADMIN", "FARM-001", old), old).getStatus());
    }

    @Test
    void signatureFromAnotherSecretIsRejected() throws Exception {
        long now = System.currentTimeMillis();
        String other = new InternalAuth("some-other-secret").sign("admin@agritech.io", "ADMIN", "FARM-001", now);
        assertEquals(401, call("ADMIN", other, now).getStatus());
    }

    @Test
    void actuatorIsNotFiltered() throws Exception {
        MockHttpServletRequest req = new MockHttpServletRequest("GET", "/actuator/health");
        assertTrue(auth.shouldNotFilter(req));
    }
}

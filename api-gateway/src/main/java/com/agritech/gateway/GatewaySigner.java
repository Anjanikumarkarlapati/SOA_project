package com.agritech.gateway;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.stereotype.Component;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.util.Base64;

/**
 * Signs the identity headers the gateway forwards, so services can prove a request came through
 * here. Mirrors com.agritech.common.InternalAuth (the gateway is reactive and cannot depend on the
 * servlet-based common module).
 */
@Component
public class GatewaySigner {

    static final String SIGNATURE_HEADER = "X-Gateway-Signature";
    static final String TIMESTAMP_HEADER = "X-Gateway-Timestamp";

    private final byte[] secret;

    public GatewaySigner(@Value("${AGRITECH_INTERNAL_SECRET:agritech-internal-dev-secret-change-me-0123456789}") String secret) {
        this.secret = secret.getBytes(StandardCharsets.UTF_8);
    }

    /** Sets email/role/farm plus timestamp and signature on outgoing headers. */
    void apply(HttpHeaders h, String email, String role, String farmId) {
        long ts = System.currentTimeMillis();
        h.set("X-User-Email", email);
        h.set("X-User-Role", role);
        h.set("X-Farm-Id", farmId);
        h.set(TIMESTAMP_HEADER, Long.toString(ts));
        h.set(SIGNATURE_HEADER, sign(email, role, farmId, ts));
    }

    String sign(String email, String role, String farmId, long ts) {
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(secret, "HmacSHA256"));
            String payload = email + "|" + role + "|" + farmId + "|" + ts;
            return Base64.getEncoder().encodeToString(mac.doFinal(payload.getBytes(StandardCharsets.UTF_8)));
        } catch (Exception e) {
            throw new IllegalStateException("HMAC unavailable", e);
        }
    }
}

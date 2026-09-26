package com.agritech.common;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.client.ClientHttpRequestInterceptor;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.Base64;

/**
 * Zero-trust between the gateway and the services. The gateway signs the identity headers it
 * forwards; every service rejects an /api request whose signature is missing, wrong, or stale.
 * Without this, anyone who can reach port 8082 directly could send "X-User-Role: ADMIN".
 *
 * Signature = Base64(HMAC-SHA256(secret, email|role|farmId|timestampMillis)).
 * Service-to-service calls sign themselves as the SERVICE identity via {@link #interceptor()}.
 */
@Component
public class InternalAuth extends OncePerRequestFilter {

    public static final String SIGNATURE_HEADER = "X-Gateway-Signature";
    public static final String TIMESTAMP_HEADER = "X-Gateway-Timestamp";
    public static final String SERVICE_ROLE = "SERVICE";
    static final long MAX_SKEW_MS = 60_000;

    private final byte[] secret;

    public InternalAuth(@Value("${AGRITECH_INTERNAL_SECRET:agritech-internal-dev-secret-change-me-0123456789}") String secret) {
        this.secret = secret.getBytes(StandardCharsets.UTF_8);
    }

    public String sign(String email, String role, String farmId, long timestamp) {
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(secret, "HmacSHA256"));
            String payload = nz(email) + "|" + nz(role) + "|" + nz(farmId) + "|" + timestamp;
            return Base64.getEncoder().encodeToString(mac.doFinal(payload.getBytes(StandardCharsets.UTF_8)));
        } catch (Exception e) {
            throw new IllegalStateException("HMAC unavailable", e);
        }
    }

    public boolean verify(String email, String role, String farmId, String timestamp, String signature, long now) {
        if (signature == null || timestamp == null) return false;
        long ts;
        try {
            ts = Long.parseLong(timestamp);
        } catch (NumberFormatException e) {
            return false;
        }
        if (Math.abs(now - ts) > MAX_SKEW_MS) return false;
        byte[] expected = sign(email, role, farmId, ts).getBytes(StandardCharsets.UTF_8);
        return MessageDigest.isEqual(expected, signature.getBytes(StandardCharsets.UTF_8));
    }

    /** Signs outgoing RestTemplate calls between services. */
    public ClientHttpRequestInterceptor interceptor() {
        return (request, body, execution) -> {
            long ts = System.currentTimeMillis();
            var h = request.getHeaders();
            h.set(CallerContext.EMAIL_HEADER, "service");
            h.set(CallerContext.ROLE_HEADER, SERVICE_ROLE);
            h.set(CallerContext.FARM_HEADER, "");
            h.set(TIMESTAMP_HEADER, Long.toString(ts));
            h.set(SIGNATURE_HEADER, sign("service", SERVICE_ROLE, "", ts));
            return execution.execute(request, body);
        };
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        return !request.getRequestURI().startsWith("/api/");
    }

    @Override
    protected void doFilterInternal(HttpServletRequest req, HttpServletResponse res, FilterChain chain)
            throws ServletException, IOException {
        if (verify(req.getHeader(CallerContext.EMAIL_HEADER), req.getHeader(CallerContext.ROLE_HEADER),
                req.getHeader(CallerContext.FARM_HEADER), req.getHeader(TIMESTAMP_HEADER),
                req.getHeader(SIGNATURE_HEADER), System.currentTimeMillis())) {
            chain.doFilter(req, res);
            return;
        }
        res.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
        res.setContentType("application/json");
        res.getWriter().write("{\"error\":\"untrusted_caller\",\"message\":"
                + "\"Requests must arrive through the API gateway\"}");
    }

    private static String nz(String s) { return s == null ? "" : s; }
}

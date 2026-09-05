package com.agritech.auth;

import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Refresh tokens and revoked access-token ids (FR-1).
 *
 * ponytail: in-memory, so a restart logs everyone out and a second auth-service
 * instance keeps its own view. Move both maps to Redis if auth is scaled out.
 */
@Component
public class TokenStore {

    private record Refresh(String email, Instant expiresAt) {}

    private final Map<String, Refresh> refreshTokens = new ConcurrentHashMap<>();
    private final Map<String, Instant> revokedJti = new ConcurrentHashMap<>();

    public String issueRefresh(String email) {
        String token = UUID.randomUUID().toString();
        refreshTokens.put(token, new Refresh(email, Instant.now().plusSeconds(30L * 86400)));
        return token;
    }

    /** Returns the owning email, or null if unknown/expired. */
    public String consumeRefresh(String token) {
        Refresh r = refreshTokens.get(token);
        if (r == null) return null;
        if (r.expiresAt().isBefore(Instant.now())) {
            refreshTokens.remove(token);
            return null;
        }
        return r.email();
    }

    public void dropRefresh(String token) {
        if (token != null) refreshTokens.remove(token);
    }

    /** Revoke an access token by its jti until it would have expired anyway. */
    public void revoke(String jti, Instant tokenExpiry) {
        if (jti != null) revokedJti.put(jti, tokenExpiry);
    }

    public Set<String> revokedIds() {
        revokedJti.values().removeIf(exp -> exp.isBefore(Instant.now()));
        return revokedJti.keySet();
    }
}

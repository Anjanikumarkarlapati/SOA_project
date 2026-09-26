package com.agritech.auth;

import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * Refresh tokens and revoked access-token ids (FR-1). Stored in the auth DB, not in memory, so
 * every auth-service instance behind the load balancer sees the same logins and logouts.
 */
@Component
public class TokenStore {

    private final StoredTokenRepository tokens;

    public TokenStore(StoredTokenRepository tokens) { this.tokens = tokens; }

    public String issueRefresh(String email) {
        String token = UUID.randomUUID().toString();
        tokens.save(new StoredToken(token, email, Instant.now().plusSeconds(30L * 86400), false));
        return token;
    }

    /** Returns the owning email, or null if unknown/expired. */
    public String consumeRefresh(String token) {
        return tokens.findById(token)
                .filter(t -> !t.isRevoked() && t.getExpiresAt().isAfter(Instant.now()))
                .map(StoredToken::getEmail)
                .orElse(null);
    }

    public void dropRefresh(String token) {
        if (token != null) tokens.deleteById(token);
    }

    /** Revoke an access token by its jti until it would have expired anyway. */
    public void revoke(String jti, Instant tokenExpiry) {
        if (jti != null) tokens.save(new StoredToken(jti, null, tokenExpiry, true));
    }

    public Set<String> revokedIds() {
        Instant now = Instant.now();
        tokens.deleteByExpiresAtBefore(now);
        return tokens.findByRevokedTrueAndExpiresAtAfter(now).stream()
                .map(StoredToken::getId).collect(Collectors.toSet());
    }
}

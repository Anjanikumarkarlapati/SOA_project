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

    /** Atomically consumes a refresh token so parallel or replayed refreshes cannot succeed. */
    @org.springframework.transaction.annotation.Transactional
    public String consumeRefresh(String token) {
        if (token == null) return null;
        StoredToken stored = tokens.findByIdForUpdate(token).orElse(null);
        if (stored == null || stored.isRevoked() || !stored.getExpiresAt().isAfter(Instant.now())
                || stored.getEmail() == null) {
            return null;
        }
        String email = stored.getEmail();
        stored.markRevoked();
        tokens.save(stored);
        return email;
    }

    public void dropRefresh(String token) {
        if (token != null) tokens.deleteById(token);
    }

    /** Every refresh token for an account, e.g. when that account is deleted. */
    public void dropAllRefresh(String email) {
        if (email != null) tokens.deleteByEmail(email);
    }

    /** Revoke an access token by its jti until it would have expired anyway. */
    public void revoke(String jti, Instant tokenExpiry) {
        if (jti != null) tokens.save(new StoredToken(jti, null, tokenExpiry, true));
    }

    public boolean isRevoked(String jti) {
        return jti != null && tokens.existsByIdAndRevokedTrue(jti);
    }

    public Set<String> revokedIds() {
        Instant now = Instant.now();
        tokens.deleteByExpiresAtBefore(now);
        return tokens.findByRevokedTrueAndEmailIsNullAndExpiresAtAfter(now).stream()
                .map(StoredToken::getId).collect(Collectors.toSet());
    }
}

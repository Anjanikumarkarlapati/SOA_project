package com.agritech.auth;

import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.Instant;

/** A refresh token (email set) or a revoked access-token jti (revoked=true). See {@link TokenStore}. */
@Entity
@Table(name = "stored_tokens")
public class StoredToken {

    @Id
    private String id;

    private String email;

    private Instant expiresAt;

    private boolean revoked;

    protected StoredToken() {}

    StoredToken(String id, String email, Instant expiresAt, boolean revoked) {
        this.id = id;
        this.email = email;
        this.expiresAt = expiresAt;
        this.revoked = revoked;
    }

    public String getId() { return id; }
    public String getEmail() { return email; }
    public Instant getExpiresAt() { return expiresAt; }
    public boolean isRevoked() { return revoked; }
}

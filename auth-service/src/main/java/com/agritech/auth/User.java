package com.agritech.auth;

import jakarta.persistence.*;

import java.time.Instant;
import java.util.UUID;

/**
 * One row per account. Idempotent by construction: email (LOCAL) and
 * (auth_provider, provider_id) (OAuth) each carry a unique constraint, and AuthService upserts
 * instead of blind-inserting, so repeat logins never create duplicate users.
 */
@Entity
@Table(name = "users",
        uniqueConstraints = {
                @UniqueConstraint(name = "uq_users_email", columnNames = "email"),
                @UniqueConstraint(name = "uq_users_provider", columnNames = {"auth_provider", "provider_id"})})
public class User {

    @Id
    private UUID id;

    @Column(nullable = false)
    private String email;

    /** Null for accounts that authenticate through an external provider (e.g. Google via Supabase). */
    @Column(name = "password_hash")
    private String passwordHash;

    /** LOCAL or GOOGLE. */
    @Column(name = "auth_provider", nullable = false, length = 32)
    private String authProvider;

    /** Stable id at the provider (Supabase user id) for GOOGLE accounts; null for LOCAL. */
    @Column(name = "provider_id")
    private String providerId;

    /** ADMIN or FARMER (FR-2). */
    @Column(nullable = false, length = 32)
    private String role;

    /** Tenant identifier used by the sensor/irrigation services; kept for cross-service JWT claims. */
    @Column(name = "farm_id", nullable = false, length = 64)
    private String farmId;

    private String name;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "last_login_at")
    private Instant lastLoginAt;

    protected User() {}

    public User(String email, String passwordHash, String authProvider, String providerId,
                String role, String farmId, String name) {
        this.email = email;
        this.passwordHash = passwordHash;
        this.authProvider = authProvider;
        this.providerId = providerId;
        this.role = role;
        this.farmId = farmId;
        this.name = name;
    }

    /** A locally authenticated account. */
    public static User local(String email, String passwordHash, String role, String farmId, String name) {
        return new User(email, passwordHash, AuthService.PROVIDER_LOCAL, null, role, farmId, name);
    }

    /** A provider-authenticated account (Google via Supabase): no local password. */
    public static User forProvider(String email, String providerId, String role, String farmId, String name) {
        return new User(email, null, AuthService.PROVIDER_GOOGLE, providerId, role, farmId, name);
    }

    /** Attach an external identity to an existing LOCAL account (first Google login with that email). */
    public void linkProvider(String provider, String providerId) {
        this.authProvider = provider;
        this.providerId = providerId;
    }

    @PrePersist
    void onCreate() {
        if (id == null) id = UUID.randomUUID();
        if (createdAt == null) createdAt = Instant.now();
        // Creating the account is the first successful login.
        if (lastLoginAt == null) lastLoginAt = createdAt;
    }

    public UUID getId() { return id; }
    public String getEmail() { return email; }
    public String getPasswordHash() { return passwordHash; }
    public String getAuthProvider() { return authProvider; }
    public String getProviderId() { return providerId; }
    public String getRole() { return role; }
    public String getFarmId() { return farmId; }
    public String getDisplayName() { return name; }
    public Instant getCreatedAt() { return createdAt; }
    public Instant getLastLoginAt() { return lastLoginAt; }

    public void setDisplayName(String name) { this.name = name; }
    public void setLastLoginAt(Instant lastLoginAt) { this.lastLoginAt = lastLoginAt; }

    /** @param passwordHash an already-hashed value (BCrypt); never a raw password. */
    public void setPasswordHash(String passwordHash) { this.passwordHash = passwordHash; }
}

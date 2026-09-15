package com.agritech.auth;

import jakarta.persistence.*;

@Entity
@Table(name = "users")
public class User {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true)
    private String email;

    /** Null for accounts that authenticate through an external provider (e.g. Google via Supabase). */
    @Column
    private String passwordHash;

    /** ADMIN or FARMER (FR-2). */
    @Column(nullable = false)
    private String role;

    @Column(nullable = false)
    private String farmId;

    private String displayName;

    protected User() {}

    public User(String email, String passwordHash, String role, String farmId, String displayName) {
        this.email = email;
        this.passwordHash = passwordHash;
        this.role = role;
        this.farmId = farmId;
        this.displayName = displayName;
    }

    /** A provider-authenticated account (Google via Supabase): no local password. */
    public static User forProvider(String email, String role, String farmId, String displayName) {
        return new User(email, null, role, farmId, displayName);
    }

    public Long getId() { return id; }
    public String getEmail() { return email; }
    public String getPasswordHash() { return passwordHash; }
    public String getRole() { return role; }
    public String getFarmId() { return farmId; }
    public String getDisplayName() { return displayName; }
}

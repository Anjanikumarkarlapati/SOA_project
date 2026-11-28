package com.agritech.auth;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface UserRepository extends JpaRepository<User, UUID> {
    Optional<User> findByEmail(String email);

    boolean existsByEmail(String email);

    /** Primary lookup for repeat OAuth logins: stable identity at the provider. */
    Optional<User> findByAuthProviderAndProviderId(String authProvider, String providerId);

    /** Test/verification helper: exactly one row per email. */
    long countByEmail(String email);
}

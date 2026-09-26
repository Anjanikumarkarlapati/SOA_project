package com.agritech.auth;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;

public interface StoredTokenRepository extends JpaRepository<StoredToken, String> {
    List<StoredToken> findByRevokedTrueAndExpiresAtAfter(Instant now);

    @Transactional
    void deleteByExpiresAtBefore(Instant now);
}

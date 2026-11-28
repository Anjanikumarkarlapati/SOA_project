package com.agritech.auth;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.transaction.annotation.Transactional;
import jakarta.persistence.LockModeType;

import java.time.Instant;
import java.util.List;

public interface StoredTokenRepository extends JpaRepository<StoredToken, String> {
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select token from StoredToken token where token.id = :id")
    java.util.Optional<StoredToken> findByIdForUpdate(@Param("id") String id);

    List<StoredToken> findByRevokedTrueAndEmailIsNullAndExpiresAtAfter(Instant now);

    boolean existsByIdAndRevokedTrue(String id);

    @Transactional
    void deleteByExpiresAtBefore(Instant now);

    /** Used on account deletion: no refresh token may outlive the user it was issued to. */
    @Transactional
    void deleteByEmail(String email);
}

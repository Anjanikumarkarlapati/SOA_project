package com.agritech.auth;

import com.agritech.common.ApiException;
import com.agritech.common.CallerContext;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.Optional;
import java.util.UUID;

/**
 * User persistence for login/sign-up. Every method is transactional so a failed write rolls back
 * atomically; controllers mint the app JWT only after these methods return (i.e. after commit),
 * so a database failure can never leak credentials for a half-created account.
 *
 * Idempotency: email and (auth_provider, provider_id) are unique in the database, and every
 * path here is upsert-shaped, so repeat logins update last_login_at on one row instead of
 * inserting duplicates. A concurrent first-login race is resolved by the unique constraint
 * (translated to a 409, or re-read for the Google path) rather than by luck.
 */
@Service
public class AuthService {

    private static final Logger audit = LoggerFactory.getLogger("AUDIT");

    static final String PROVIDER_LOCAL = "LOCAL";
    static final String PROVIDER_GOOGLE = "GOOGLE";

    /** New Google users land in FARMER role with an isolated per-account tenant id. */
    private static final String DEFAULT_PROVIDER_ROLE = "FARMER";

    private final UserRepository users;
    private final SupabaseVerifier supabase;
    private final BCryptPasswordEncoder encoder = new BCryptPasswordEncoder();

    /**
     * Verified instead of skipping the check when no such account exists. BCrypt is deliberately
     * slow, so returning early for an unknown email answered ~200 ms faster than a wrong password
     * for a known one - enough to enumerate accounts by timing. Salts are random, so this value is
     * computed once per process and can never match anything.
     */
    private final String dummyHash = encoder.encode("timing-equalizer-" + UUID.randomUUID());

    public AuthService(UserRepository users, SupabaseVerifier supabase) {
        this.users = users;
        this.supabase = supabase;
    }

    /**
     * Sign-up: create the LOCAL account. Throws 409 (email_taken) on a duplicate, race included.
     *
     * <p>Role is not a parameter. Self-registration always yields FARMER; ADMIN is granted only by
     * {@link SeedData} for the demo operator or by an existing administrator. Accepting a
     * caller-supplied role here meant {@code POST /api/auth/register {"role":"ADMIN"}} handed out a
     * genuine admin session on a public endpoint.
     */
    @Transactional
    public User register(String email, String rawPassword, String displayName) {
        String normalized = email.toLowerCase();
        if (users.existsByEmail(normalized)) {
            throw new ApiException(HttpStatus.CONFLICT, "email_taken",
                    "An account with that email already exists");
        }
        String name = displayName == null || displayName.isBlank()
                ? normalized.split("@")[0] : displayName;
        // Never trust a client-supplied farm id: each new account starts in its own tenant.
        String farmId = "FARM-" + UUID.randomUUID().toString().substring(0, 8).toUpperCase();
        User user = User.local(normalized, encoder.encode(rawPassword),
                CallerContext.FARMER_ROLE, farmId, name);
        try {
            return users.saveAndFlush(user);
        } catch (DataIntegrityViolationException e) {
            // Lost a concurrent-register race on the email unique constraint.
            audit.warn("register CONFLICT email={} (unique constraint)", normalized);
            throw new ApiException(HttpStatus.CONFLICT, "email_taken",
                    "An account with that email already exists");
        }
        // Any other DataAccessException propagates: the transaction rolls back and the
        // controller returns a plain 500 without ever issuing a token.
    }

    /**
     * Password change for the signed-in account. The current password is required, so a leaked
     * access token cannot be used to lock the real owner out of their account.
     */
    @Transactional
    public User changePassword(String email, String currentPassword, String newPassword) {
        if (newPassword == null || newPassword.length() < 8) {
            throw ApiException.badRequest("newPassword must be at least 8 characters");
        }
        User user = users.findByEmail(email.toLowerCase()).orElse(null);
        String hash = (user == null || user.getPasswordHash() == null) ? dummyHash : user.getPasswordHash();
        boolean ok = encoder.matches(currentPassword, hash);
        if (user == null || !ok) {
            throw new ApiException(HttpStatus.UNAUTHORIZED, "invalid_credentials",
                    "Current password is incorrect");
        }
        user.setPasswordHash(encoder.encode(newPassword));
        audit.info("password changed email={}", user.getEmail());
        return users.save(user);
    }

    /** Account deletion (right to be forgotten). The caller's tokens are revoked separately. */
    @Transactional
    public void deleteAccount(String email) {
        User user = users.findByEmail(email.toLowerCase()).orElse(null);
        if (user == null) {
            throw ApiException.notFound("Account", email);
        }
        users.delete(user);
        audit.info("account deleted email={} farm={}", user.getEmail(), user.getFarmId());
    }

    /** Password login: verifies credentials, then updates last_login_at on the existing row. */
    @Transactional
    public User login(String email, String rawPassword) {
        User user = users.findByEmail(email.toLowerCase()).orElse(null);
        // One and only one BCrypt run per attempt, whether or not the account exists.
        String hash = (user == null || user.getPasswordHash() == null) ? dummyHash : user.getPasswordHash();
        boolean credentialsOk = encoder.matches(rawPassword, hash);
        if (user == null || !credentialsOk) {
            throw new ApiException(HttpStatus.UNAUTHORIZED, "invalid_credentials",
                    "Incorrect email or password");
        }
        return touch(user);
    }

    /**
     * Google sign-in via Supabase: verifies the token with Supabase, then upserts the user.
     * First login provisions a FARMER account; repeat logins find the same row via the
     * (GOOGLE, provider id) unique key and update last_login_at.
     */
    @Transactional
    public User loginWithGoogle(String accessToken) {
        SupabaseVerifier.VerifiedUser verified = supabase.verifiedUser(accessToken);
        User user = upsertGoogleUser(verified);
        return touch(user);
    }

    /** Used by /refresh after the refresh token is consumed. Read-only: not a new login. */
    @Transactional(readOnly = true)
    public User findByEmail(String email) {
        return users.findByEmail(email.toLowerCase()).orElse(null);
    }

    private User upsertGoogleUser(SupabaseVerifier.VerifiedUser verified) {
        // 1. Provider id first: the stable identity survives Google email changes.
        Optional<User> existing = verified.providerId() == null ? Optional.empty()
                : users.findByAuthProviderAndProviderId(PROVIDER_GOOGLE, verified.providerId());
        // 2. Fall back to email: either the account already used Google (older row without a
        //    provider id) or it is a LOCAL account we link on its first Google login.
        if (existing.isEmpty()) {
            existing = users.findByEmail(verified.email());
            if (existing.isPresent() && PROVIDER_LOCAL.equals(existing.get().getAuthProvider())) {
                if (CallerContext.ADMIN_ROLE.equals(existing.get().getRole())) {
                    throw new ApiException(HttpStatus.FORBIDDEN, "provider_link_forbidden",
                            "Administrator accounts must sign in with local credentials");
                }
                existing.get().linkProvider(PROVIDER_GOOGLE, verified.providerId());
            }
        }
        if (existing.isPresent()) {
            if (verified.displayName() != null && !verified.displayName().isBlank()) {
                existing.get().setDisplayName(verified.displayName());
            }
            return existing.get();
        }
        // 3. First login: provision in its own isolated tenant (like register()).
        String name = (verified.displayName() == null || verified.displayName().isBlank())
                ? verified.email().split("@")[0] : verified.displayName();
        String farmId = "FARM-" + UUID.randomUUID().toString().substring(0, 8).toUpperCase();
        User created = User.forProvider(verified.email(), verified.providerId(),
                DEFAULT_PROVIDER_ROLE, farmId, name);
        audit.info("provision google email={} role={} farm={}",
                created.getEmail(), created.getRole(), created.getFarmId());
        try {
            return users.saveAndFlush(created);
        } catch (DataIntegrityViolationException race) {
            // Two parallel first logins: the other request won the insert. Re-read so this
            // login is still idempotent instead of erroring out.
            return users.findByAuthProviderAndProviderId(PROVIDER_GOOGLE, verified.providerId())
                    .or(() -> users.findByEmail(verified.email()))
                    .orElseThrow(() -> race);
        }
    }

    private User touch(User user) {
        user.setLastLoginAt(Instant.now());
        return users.save(user);
    }
}

package com.agritech.auth;

import com.agritech.common.ApiException;
import com.agritech.common.CallerContext;
import io.jsonwebtoken.Claims;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Set;

/**
 * HTTP layer only. All persistence lives in AuthService behind @Transactional boundaries, and
 * issue() runs after the service returns - i.e. after the DB write has committed - so a failed
 * write (rollback + 500) can never hand out a token.
 */
@RestController
@RequestMapping("/api/auth")
public class AuthController {

    /** PRD 5.4: audit log for every authentication attempt and admin action. */
    private static final Logger audit = LoggerFactory.getLogger("AUDIT");

    private final AuthService auth;
    private final JwtService jwt;
    private final TokenStore tokens;

    public AuthController(AuthService auth, JwtService jwt, TokenStore tokens) {
        this.auth = auth;
        this.jwt = jwt;
        this.tokens = tokens;
    }

    /**
     * @param role accepted for compatibility with existing clients and deliberately ignored:
     *             self-registration can never grant ADMIN. See PRD 5.2 / FR-2.
     */
    public record RegisterRequest(
            @Email(message = "must be a valid email address") @NotBlank String email,
            @NotBlank @Size(min = 8, message = "must be at least 8 characters") String password,
            String role,
            String displayName) {}

    public record LoginRequest(@NotBlank String email, @NotBlank String password) {}

    public record GoogleRequest(@NotBlank String accessToken) {}

    public record ChangePasswordRequest(@NotBlank String currentPassword,
                                        @NotBlank @Size(min = 8) String newPassword) {}

    public record TokenResponse(String token, String refreshToken, long expiresIn,
                                String email, String role, String farmId, String displayName) {}

    @PostMapping("/register")
    @ResponseStatus(HttpStatus.CREATED)
    public TokenResponse register(@Valid @RequestBody RegisterRequest req) {
        // No role argument: AuthService always provisions a FARMER.
        User user = auth.register(req.email(), req.password(), req.displayName());
        audit.info("register email={} role={} farm={} provider=LOCAL",
                user.getEmail(), user.getRole(), user.getFarmId());
        return issue(user);
    }

    @PostMapping("/login")
    public TokenResponse login(@Valid @RequestBody LoginRequest req) {
        User user;
        try {
            user = auth.login(req.email(), req.password());
        } catch (ApiException e) {
            audit.warn("login FAILED email={} code={}", req.email(), e.code());
            throw e;
        }
        audit.info("login OK email={} role={} provider={}",
                user.getEmail(), user.getRole(), user.getAuthProvider());
        return issue(user);
    }

    /**
     * Google sign-in via Supabase. The SPA completes the Google OAuth flow through Supabase and
     * posts the resulting Supabase access token here; we verify it and mint our own app JWT.
     * First-time Google users are provisioned read-only (FARMER) on the demo farm; repeat
     * logins are idempotent (one user row per Google identity).
     */
    @PostMapping("/google")
    public TokenResponse google(@Valid @RequestBody GoogleRequest req) {
        User user = auth.loginWithGoogle(req.accessToken());
        audit.info("login OK via=google email={} role={}", user.getEmail(), user.getRole());
        return issue(user);
    }

    @PostMapping("/refresh")
    public TokenResponse refresh(@RequestBody Map<String, String> body) {
        String refreshToken = body == null ? null : body.get("refreshToken");
        String email = tokens.consumeRefresh(refreshToken);
        if (email == null) {
            throw new ApiException(HttpStatus.UNAUTHORIZED, "invalid_refresh_token",
                    "Refresh token is invalid, expired, or already used");
        }
        User user = auth.findByEmail(email);
        if (user == null) {
            throw new ApiException(HttpStatus.UNAUTHORIZED, "invalid_refresh_token",
                    "Account no longer exists");
        }
        return issue(user);
    }

    @PostMapping("/logout")
    public Map<String, String> logout(@RequestHeader(value = "Authorization", required = false) String authHeader,
                                      @RequestBody(required = false) Map<String, String> body) {
        if (authHeader != null && authHeader.startsWith("Bearer ")) {
            try {
                Claims claims = jwt.parse(authHeader.substring(7));
                tokens.revoke(claims.getId(), claims.getExpiration().toInstant());
                audit.info("logout email={}", claims.getSubject());
            } catch (Exception ignored) {
                // Already-invalid token: logging out is still a success from the client's view.
            }
        }
        if (body != null) tokens.dropRefresh(body.get("refreshToken"));
        return Map.of("status", "logged_out");
    }

    /** Polled by the gateway so revoked access tokens stop working before they expire. */
    @GetMapping("/revoked")
    public Set<String> revoked(HttpServletRequest http) {
        if (!CallerContext.isPrivileged(http)) {
            throw ApiException.forbidden("Service or administrator role required");
        }
        return tokens.revokedIds();
    }

    @GetMapping("/me")
    public Map<String, Object> me(@RequestHeader(value = "Authorization", required = false) String authHeader) {
        Claims c = parseActiveBearer(authHeader);
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("email", c.getSubject());
        out.put("role", c.get("role"));
        out.put("farmId", c.get("farmId"));
        out.put("displayName", c.get("name") == null ? "" : String.valueOf(c.get("name")));
        out.put("expiresAt", c.getExpiration().toInstant().toString());
        return out;
    }

    /** Update: change the signed-in account's password. The current one is required. */
    @PutMapping("/me")
    public Map<String, String> changePassword(@Valid @RequestBody ChangePasswordRequest req,
                                              @RequestHeader(value = "Authorization", required = false) String authHeader) {
        auth.changePassword(parseActiveBearer(authHeader).getSubject(), req.currentPassword(), req.newPassword());
        return Map.of("status", "password_changed");
    }

    /**
     * Delete: close the signed-in account. Every refresh token is dropped and the presenting
     * access token is revoked, so the session dies immediately instead of surviving to its expiry.
     */
    @DeleteMapping("/me")
    public Map<String, String> deleteAccount(@RequestHeader(value = "Authorization", required = false) String authHeader) {
        Claims claims = parseActiveBearer(authHeader);
        String email = claims.getSubject();
        tokens.dropAllRefresh(email);
        tokens.revoke(claims.getId(), claims.getExpiration().toInstant());
        auth.deleteAccount(email);
        audit.info("account deleted email={} (session revoked)", email);
        return Map.of("status", "deleted", "email", email);
    }

    /** The verified, non-revoked bearer claims, or 401. */
    private Claims parseActiveBearer(String authHeader) {
        if (authHeader == null || !authHeader.startsWith("Bearer ")) {
            throw new ApiException(HttpStatus.UNAUTHORIZED, "unauthorized", "Missing bearer token");
        }
        Claims claims = jwt.parse(authHeader.substring(7));
        if (tokens.isRevoked(claims.getId())) {
            throw new ApiException(HttpStatus.UNAUTHORIZED, "token_revoked", "Token has been revoked");
        }
        return claims;
    }

    /** Minted strictly after AuthService committed the DB write. */
    private TokenResponse issue(User user) {
        return new TokenResponse(jwt.issue(user), tokens.issueRefresh(user.getEmail()), jwt.accessTtlSeconds(),
                user.getEmail(), user.getRole(), user.getFarmId(), user.getDisplayName());
    }
}

package com.agritech.auth;

import com.agritech.common.ApiException;
import io.jsonwebtoken.Claims;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.Set;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    /** PRD 5.4: audit log for every authentication attempt and admin action. */
    private static final Logger audit = LoggerFactory.getLogger("AUDIT");

    private final UserRepository users;
    private final JwtService jwt;
    private final TokenStore tokens;
    private final BCryptPasswordEncoder encoder = new BCryptPasswordEncoder();

    public AuthController(UserRepository users, JwtService jwt, TokenStore tokens) {
        this.users = users;
        this.jwt = jwt;
        this.tokens = tokens;
    }

    public record RegisterRequest(
            @Email(message = "must be a valid email address") @NotBlank String email,
            @NotBlank @Size(min = 8, message = "must be at least 8 characters") String password,
            @NotBlank String role,
            @NotBlank String farmId,
            String displayName) {}

    public record LoginRequest(@NotBlank String email, @NotBlank String password) {}

    public record TokenResponse(String token, String refreshToken, long expiresIn,
                                String email, String role, String farmId, String displayName) {}

    @PostMapping("/register")
    @ResponseStatus(HttpStatus.CREATED)
    public TokenResponse register(@Valid @RequestBody RegisterRequest req) {
        String role = req.role().toUpperCase();
        if (!role.equals("ADMIN") && !role.equals("FARMER")) {
            throw ApiException.badRequest("role must be ADMIN or FARMER");
        }
        if (users.existsByEmail(req.email())) {
            throw new ApiException(HttpStatus.CONFLICT, "email_taken", "An account with that email already exists");
        }
        String name = (req.displayName() == null || req.displayName().isBlank())
                ? req.email().split("@")[0] : req.displayName();
        User user = users.save(new User(req.email(), encoder.encode(req.password()), role, req.farmId(), name));
        audit.info("register email={} role={} farm={}", user.getEmail(), user.getRole(), user.getFarmId());
        return issue(user);
    }

    @PostMapping("/login")
    public TokenResponse login(@Valid @RequestBody LoginRequest req) {
        User user = users.findByEmail(req.email()).orElse(null);
        if (user == null || !encoder.matches(req.password(), user.getPasswordHash())) {
            audit.warn("login FAILED email={}", req.email());
            throw new ApiException(HttpStatus.UNAUTHORIZED, "invalid_credentials", "Incorrect email or password");
        }
        audit.info("login OK email={} role={}", user.getEmail(), user.getRole());
        return issue(user);
    }

    @PostMapping("/refresh")
    public TokenResponse refresh(@RequestBody Map<String, String> body) {
        String refreshToken = body.get("refreshToken");
        String email = refreshToken == null ? null : tokens.consumeRefresh(refreshToken);
        if (email == null) {
            throw new ApiException(HttpStatus.UNAUTHORIZED, "invalid_refresh_token", "Refresh token is invalid or expired");
        }
        tokens.dropRefresh(refreshToken);
        User user = users.findByEmail(email)
                .orElseThrow(() -> new ApiException(HttpStatus.UNAUTHORIZED, "invalid_refresh_token", "Account no longer exists"));
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
    public Set<String> revoked() {
        return tokens.revokedIds();
    }

    @GetMapping("/me")
    public Map<String, Object> me(@RequestHeader(value = "Authorization", required = false) String authHeader) {
        if (authHeader == null || !authHeader.startsWith("Bearer ")) {
            throw new ApiException(HttpStatus.UNAUTHORIZED, "unauthorized", "Missing bearer token");
        }
        Claims c = jwt.parse(authHeader.substring(7));
        return Map.of("email", c.getSubject(), "role", c.get("role"), "farmId", c.get("farmId"),
                "displayName", String.valueOf(c.get("name")), "expiresAt", c.getExpiration().toInstant().toString());
    }

    private TokenResponse issue(User user) {
        return new TokenResponse(jwt.issue(user), tokens.issueRefresh(user.getEmail()), jwt.accessTtlSeconds(),
                user.getEmail(), user.getRole(), user.getFarmId(), user.getDisplayName());
    }
}

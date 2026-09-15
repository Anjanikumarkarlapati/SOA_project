package com.agritech.auth;

import com.agritech.common.ApiException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;

/**
 * Verifies a Supabase-issued access token by asking Supabase itself: GET {project-url}/auth/v1/user
 * with the token as bearer. Supabase is the authority on its own tokens, so this works with both
 * the legacy HS256 JWT secret and the newer asymmetric (ES256/JWKS) signing keys without us
 * tracking or rotating keys locally. The email Supabase returns is the verified identity we mint
 * our own app JWT against.
 */
@Service
public class SupabaseVerifier {

    /** Full /auth/v1/user endpoint, or null when the project URL is not configured. */
    private final String endpoint;
    private final String anonKey;
    private final HttpClient http;
    private final ObjectMapper json = new ObjectMapper();

    @Autowired
    public SupabaseVerifier(@Value("${agritech.supabase.url:}") String projectUrl,
                            @Value("${agritech.supabase.anon-key:}") String anonKey) {
        this(projectUrl, anonKey, HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(5)).build());
    }

    SupabaseVerifier(String projectUrl, String anonKey, HttpClient http) {
        this.endpoint = (projectUrl == null || projectUrl.isBlank())
                ? null : projectUrl.replaceAll("/+$", "") + "/auth/v1/user";
        this.anonKey = anonKey == null ? "" : anonKey.strip();
        this.http = http;
    }

    /** Returns the verified email, or throws 401 if the token is missing/invalid/expired. */
    public String verifiedEmail(String accessToken) {
        // Left blank until a Supabase project is configured; then we reject every token rather
        // than trusting an unverified one.
        if (endpoint == null || anonKey.isBlank()) {
            throw new ApiException(HttpStatus.SERVICE_UNAVAILABLE, "google_signin_unconfigured",
                    "Google sign-in is not configured on this server");
        }
        if (accessToken == null || accessToken.isBlank()) {
            throw new ApiException(HttpStatus.UNAUTHORIZED, "invalid_token", "Missing Supabase token");
        }
        JsonNode user;
        try {
            HttpRequest req = HttpRequest.newBuilder(URI.create(endpoint))
                    .timeout(Duration.ofSeconds(5))
                    .header("Authorization", "Bearer " + accessToken)
                    .header("apikey", anonKey)
                    .GET()
                    .build();
            HttpResponse<String> res = http.send(req, HttpResponse.BodyHandlers.ofString());
            if (res.statusCode() == 401 || res.statusCode() == 403) {
                throw new ApiException(HttpStatus.UNAUTHORIZED, "invalid_token",
                        "Supabase token is invalid or has expired");
            }
            if (res.statusCode() != 200) {
                throw new ApiException(HttpStatus.BAD_GATEWAY, "supabase_unreachable",
                        "Supabase rejected the verification request");
            }
            user = json.readTree(res.body());
        } catch (ApiException e) {
            throw e;
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new ApiException(HttpStatus.BAD_GATEWAY, "supabase_unreachable", "Could not reach Supabase");
        } catch (Exception e) {
            throw new ApiException(HttpStatus.BAD_GATEWAY, "supabase_unreachable", "Could not reach Supabase");
        }
        String email = user.path("email").asText(null);
        if (email == null || email.isBlank()) {
            throw new ApiException(HttpStatus.UNAUTHORIZED, "invalid_token", "Token carries no email");
        }
        // Supabase sets this once the provider confirms the address; don't provision on an unverified one.
        if (!user.path("email_verified").asBoolean(true)) {
            throw new ApiException(HttpStatus.UNAUTHORIZED, "email_unverified", "Email is not verified");
        }
        return email.toLowerCase();
    }
}

package com.agritech.common;

import java.nio.charset.StandardCharsets;
import java.util.Set;

/**
 * Fail-fast validation of the two signing secrets the platform cannot run without.
 *
 * <p>Before this, both secrets had a literal development default committed to the repository
 * ({@code ${AGRITECH_JWT_SECRET:agritech-dev-secret-...}} in the YAML, and the same string as a
 * {@code @Value} fallback). A stack started without environment variables therefore signed and
 * verified tokens with a key anyone reading the repo could reproduce, which is enough to mint an
 * ADMIN access token or forge a gateway identity signature. The defaults are gone: a missing,
 * short, or previously-published secret now stops the service at startup instead of running
 * insecurely.
 *
 * <p>Generate one per environment:
 * <pre>{@code openssl rand -hex 32}</pre>
 */
public final class Secrets {

    /** HS256 needs >= 256 bits of key material; 32 ASCII characters is the practical minimum. */
    public static final int MIN_LENGTH = 32;

    /**
     * Values that were published as development defaults and must never be accepted again, so a
     * stale {@code .env} cannot quietly keep the old (public) key in play after rotation.
     */
    private static final Set<String> KNOWN_INSECURE = Set.of(
            "agritech-dev-secret-key-change-me-in-production-0123456789",
            "agritech-internal-dev-secret-change-me-0123456789");

    private Secrets() {}

    /** Validates a secret and returns its UTF-8 bytes. Throws {@link IllegalStateException} if unusable. */
    public static byte[] requireBytes(String name, String value) {
        return require(name, value).getBytes(StandardCharsets.UTF_8);
    }

    /** Validates a secret and returns it unchanged. Throws {@link IllegalStateException} if unusable. */
    public static String require(String name, String value) {
        if (value == null || value.isBlank()) {
            throw new IllegalStateException(name + " is not set. Generate one with `openssl rand -hex 32`"
                    + " and put it in the environment (see .env.example). Refusing to start with an"
                    + " unsigned or default key.");
        }
        if (value.length() < MIN_LENGTH) {
            throw new IllegalStateException(name + " must be at least " + MIN_LENGTH
                    + " characters for HS256; got " + value.length() + ".");
        }
        if (KNOWN_INSECURE.contains(value)) {
            throw new IllegalStateException(name + " is set to a default that was published in this"
                    + " repository's history. Rotate it (`openssl rand -hex 32`) before starting.");
        }
        return value;
    }
}

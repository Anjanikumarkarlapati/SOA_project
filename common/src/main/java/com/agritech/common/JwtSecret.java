package com.agritech.common;

import java.nio.charset.StandardCharsets;

/**
 * Validates the HMAC signing secret before a service builds a key from it.
 *
 * The secret used to ship with a working default baked into application.yml. That is a published
 * signing key: anyone with the repository could mint a valid ADMIN token against any deployment
 * that had not overridden it. There is deliberately no fallback now - a missing secret stops the
 * service at startup rather than letting it silently accept forged tokens.
 *
 * Kept free of any JWT dependency so `common` stays a plain shared module; callers turn the
 * returned bytes into whatever key type their library wants.
 */
public final class JwtSecret {

    /** HS256 needs a key of at least 256 bits. */
    private static final int MIN_BYTES = 32;

    private JwtSecret() {}

    /** The secret's bytes, or IllegalStateException if it is missing or too weak to sign with. */
    public static byte[] bytes(String secret) {
        if (secret == null || secret.isBlank()) {
            throw new IllegalStateException(
                    "AGRITECH_JWT_SECRET is not set. The gateway and auth-service must share one "
                            + "secret: auth-service signs tokens with it and the gateway verifies "
                            + "them. Generate one and export it for both, e.g. "
                            + "export AGRITECH_JWT_SECRET=$(openssl rand -base64 48)");
        }
        byte[] raw = secret.getBytes(StandardCharsets.UTF_8);
        if (raw.length < MIN_BYTES) {
            throw new IllegalStateException(
                    "AGRITECH_JWT_SECRET is too short: HS256 needs at least " + MIN_BYTES
                            + " bytes, got " + raw.length + ". Try: openssl rand -base64 48");
        }
        return raw;
    }
}

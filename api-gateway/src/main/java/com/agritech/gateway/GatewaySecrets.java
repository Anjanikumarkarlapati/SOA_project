package com.agritech.gateway;

/**
 * Startup validation for the gateway's two signing secrets.
 *
 * <p>Mirrors {@code com.agritech.common.Secrets}. The gateway is a WebFlux application and does not
 * depend on the servlet-based {@code common} module, so the rules are duplicated here rather than
 * imported; both copies reject the same three cases, and the unit tests in each module assert it.
 */
final class GatewaySecrets {

    private static final String PUBLISHED_JWT_DEFAULT = "agritech-dev-secret-key-change-me-in-production-0123456789";
    private static final String PUBLISHED_INTERNAL_DEFAULT = "agritech-internal-dev-secret-change-me-0123456789";

    private GatewaySecrets() {}

    /** @return the value, when it is usable as an HMAC/HS256 key. @throws IllegalStateException if not. */
    static String require(String name, String value) {
        if (value == null || value.isBlank()) {
            throw new IllegalStateException(name + " is not set. Generate one with `openssl rand -hex 32`"
                    + " and put it in the environment (see .env.example). Refusing to start with an"
                    + " unsigned or default key.");
        }
        if (value.length() < 32) {
            throw new IllegalStateException(name + " must be at least 32 characters for HS256/HMAC-SHA256;"
                    + " got " + value.length() + ".");
        }
        if (PUBLISHED_JWT_DEFAULT.equals(value) || PUBLISHED_INTERNAL_DEFAULT.equals(value)) {
            throw new IllegalStateException(name + " is set to a default that was published in this"
                    + " repository's history, so any reader could forge tokens or gateway signatures."
                    + " Rotate it (`openssl rand -hex 32`) before starting.");
        }
        return value;
    }
}

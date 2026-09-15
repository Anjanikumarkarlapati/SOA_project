package com.agritech.auth;

import com.agritech.common.ApiException;
import com.sun.net.httpserver.HttpServer;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

/** The verifier trusts only what Supabase's /auth/v1/user endpoint confirms about a token. */
class SupabaseVerifierTest {

    private HttpServer server;
    private int responseStatus;
    private String responseBody;

    @BeforeEach
    void startServer() throws Exception {
        server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext("/auth/v1/user", exchange -> {
            byte[] out = responseBody.getBytes(StandardCharsets.UTF_8);
            exchange.sendResponseHeaders(responseStatus, out.length);
            try (OutputStream os = exchange.getResponseBody()) {
                os.write(out);
            }
        });
        server.start();
    }

    @AfterEach
    void stopServer() {
        server.stop(0);
    }

    private SupabaseVerifier configured() {
        return new SupabaseVerifier("http://127.0.0.1:" + server.getAddress().getPort(), "test-anon-key");
    }

    @Test
    void acceptsVerifiedEmailAndLowercasesIt() {
        responseStatus = 200;
        responseBody = "{\"email\":\"User@Gmail.com\",\"email_verified\":true}";
        assertEquals("user@gmail.com", configured().verifiedEmail("some-access-token"));
    }

    @Test
    void acceptsWhenEmailVerifiedFieldAbsent() {
        responseStatus = 200;
        responseBody = "{\"email\":\"a@b.com\"}";
        assertEquals("a@b.com", configured().verifiedEmail("some-access-token"));
    }

    @Test
    void rejectsUnverifiedEmail() {
        responseStatus = 200;
        responseBody = "{\"email\":\"user@gmail.com\",\"email_verified\":false}";
        assertThrows(ApiException.class, () -> configured().verifiedEmail("some-access-token"));
    }

    @Test
    void rejectsTokenSupabaseDoesNotRecognise() {
        responseStatus = 401;
        responseBody = "{\"message\":\"invalid JWT\"}";
        assertThrows(ApiException.class, () -> configured().verifiedEmail("forged-token"));
    }

    @Test
    void rejectsTokenWithoutEmail() {
        responseStatus = 200;
        responseBody = "{\"email\":\"\"}";
        assertThrows(ApiException.class, () -> configured().verifiedEmail("some-access-token"));
    }

    @Test
    void rejectsMissingAccessToken() {
        responseStatus = 200;
        responseBody = "{\"email\":\"user@gmail.com\"}";
        assertThrows(ApiException.class, () -> configured().verifiedEmail(""));
    }

    @Test
    void rejectsWhenUnconfigured() {
        var unconfigured = new SupabaseVerifier("", "");
        assertThrows(ApiException.class, () -> unconfigured.verifiedEmail("some-access-token"));
    }
}

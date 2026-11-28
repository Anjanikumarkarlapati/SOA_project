package com.agritech.auth;

import com.agritech.common.ApiException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.HttpStatus;

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.when;

/**
 * User-persistence behaviour on the real schema (Flyway V1 on isolated in-memory H2): new user,
 * returning user, duplicate email, and idempotent repeat OAuth logins.
 */
/**
 * H2 folds unquoted identifiers to upper case, PostgreSQL to lower case. Flyway's V1 writes
 * {@code CREATE TABLE users} unquoted, so on plain H2 the table lands as USERS while Hibernate
 * validates auth_service.users and the context will not start. DATABASE_TO_LOWER=TRUE makes the
 * in-memory database fold identifiers the way the production PostgreSQL schema does - the same
 * setting the H2 fallback URLs in application.yml carry.
 */
@SpringBootTest(properties = {
        "spring.datasource.url=jdbc:h2:mem:auth-service-test;DB_CLOSE_DELAY=-1;DATABASE_TO_LOWER=TRUE",
        "spring.datasource.username=sa",
        "spring.datasource.password=",
        "eureka.client.enabled=false",
        "spring.cloud.discovery.enabled=false"
})
class AuthServicePersistenceTest {

    @Autowired AuthService auth;
    @Autowired UserRepository users;

    /** No network in tests: the verifier is replaced with a canned Google identity. */
    @MockBean SupabaseVerifier supabase;

    private static final SupabaseVerifier.VerifiedUser GOOGLE_IDENTITY =
            new SupabaseVerifier.VerifiedUser("greg@gmail.com", "sup-user-1", "Greg Gopal");

    @BeforeEach
    void clearIsolatedDatabase() {
        users.deleteAll();
    }

    @Test
    void newRegisterPersistsUserWithUuidAndTimestamps() {
        String email = "new-" + UUID.randomUUID() + "@example.com";
        User created = auth.register(email, "password123", "Priya Fields");

        assertThat(created.getId()).isNotNull();
        assertThat(created.getId()).isInstanceOf(UUID.class);
        assertThat(created.getAuthProvider()).isEqualTo("LOCAL");
        assertThat(created.getProviderId()).isNull();
        assertThat(created.getPasswordHash()).isNotBlank().isNotEqualTo("password123");
        assertThat(created.getCreatedAt()).isNotNull();
        assertThat(created.getLastLoginAt()).isEqualTo(created.getCreatedAt()); // first login = creation
        assertThat(created.getRole()).isEqualTo("FARMER");
        assertThat(created.getFarmId()).startsWith("FARM-");
        assertThat(created.getDisplayName()).isEqualTo("Priya Fields");

        // It actually hit the database.
        assertThat(users.findByEmail(email.toLowerCase())).isPresent();
    }

    @Test
    void returningLoginUpdatesLastLoginAtWithoutDuplicatingTheUser() throws Exception {
        String email = "returning-" + UUID.randomUUID() + "@example.com";
        User created = auth.register(email, "password123", null);
        var persistedLastLogin = users.findByEmail(email.toLowerCase()).orElseThrow().getLastLoginAt();
        Thread.sleep(25); // distinct timestamp

        User loggedIn = auth.login(email, "password123");

        assertThat(loggedIn.getId()).isEqualTo(created.getId()); // same row, not a new user
        assertThat(loggedIn.getLastLoginAt()).isAfter(created.getCreatedAt());
        assertThat(users.countByEmail(email.toLowerCase())).isEqualTo(1);
    }

    @Test
    void duplicateEmailIsRejectedWithConflict() {
        String email = "dupe-" + UUID.randomUUID() + "@example.com";
        auth.register(email, "password123", null);

        assertThatThrownBy(() -> auth.register(email.toUpperCase(), "other-pass-1", null))
                .isInstanceOf(ApiException.class)
                .satisfies(e -> {
                    ApiException api = (ApiException) e;
                    assertThat(api.status()).isEqualTo(HttpStatus.CONFLICT);
                    assertThat(api.code()).isEqualTo("email_taken");
                });
        assertThat(users.countByEmail(email.toLowerCase())).isEqualTo(1);
    }

    @Test
    void wrongPasswordIsRejectedAndLastLoginUnchanged() {
        String email = "wrongpw-" + UUID.randomUUID() + "@example.com";
        auth.register(email, "password123", null);
        var persistedLastLogin = users.findByEmail(email.toLowerCase()).orElseThrow().getLastLoginAt();

        assertThatThrownBy(() -> auth.login(email, "password999"))
                .isInstanceOf(ApiException.class)
                .satisfies(e -> assertThat(((ApiException) e).status()).isEqualTo(HttpStatus.UNAUTHORIZED));

        User unchanged = users.findByEmail(email.toLowerCase()).orElseThrow();
        assertThat(unchanged.getLastLoginAt()).isEqualTo(persistedLastLogin);
    }

    @Test
    void repeatedGoogleLoginIsIdempotent() {
        when(supabase.verifiedUser(anyString())).thenReturn(GOOGLE_IDENTITY);

        User first = auth.loginWithGoogle("google-token");
        User second = auth.loginWithGoogle("google-token");

        // One row per Google identity, no duplicates on repeat logins.
        assertThat(users.findByEmail("greg@gmail.com")).isPresent();
        assertThat(users.countByEmail("greg@gmail.com")).isEqualTo(1);
        assertThat(second.getId()).isEqualTo(first.getId());
        assertThat(second.getAuthProvider()).isEqualTo("GOOGLE");
        assertThat(second.getProviderId()).isEqualTo("sup-user-1");
        assertThat(second.getPasswordHash()).isNull();
        assertThat(second.getLastLoginAt()).isAfter(first.getCreatedAt());
        assertThat(second.getDisplayName()).isEqualTo("Greg Gopal");
    }

    @Test
    void googleLoginLinksAnExistingLocalAccount() {
        when(supabase.verifiedUser(anyString())).thenReturn(GOOGLE_IDENTITY);
        auth.register("greg@gmail.com", "password123", "Old Name");

        User linked = auth.loginWithGoogle("google-token");

        // One row, now carrying the Google identity alongside the local password.
        assertThat(users.countByEmail("greg@gmail.com")).isEqualTo(1);
        assertThat(linked.getAuthProvider()).isEqualTo("GOOGLE");
        assertThat(linked.getProviderId()).isEqualTo("sup-user-1");
        assertThat(linked.getPasswordHash()).isNotBlank(); // local login still works
        assertThat(linked.getDisplayName()).isEqualTo("Greg Gopal"); // refreshed from provider
    }

    @Test
    void googleUserGetsIsolatedTenantAndCannotLinkAdminAccount() {
        when(supabase.verifiedUser(anyString())).thenReturn(GOOGLE_IDENTITY);
        User googleOnly = auth.loginWithGoogle("google-token");
        assertThat(googleOnly.getFarmId()).startsWith("FARM-").isNotEqualTo("FARM-001");
        assertThat(googleOnly.getRole()).isEqualTo("FARMER");

        User admin = users.saveAndFlush(User.local("boss@agritech.io", "hash", "ADMIN", "FARM-001", "Boss"));
        when(supabase.verifiedUser("admin-email-token"))
                .thenReturn(new SupabaseVerifier.VerifiedUser("boss@agritech.io", "sup-boss", "Boss"));

        assertThatThrownBy(() -> auth.loginWithGoogle("admin-email-token"))
                .isInstanceOf(ApiException.class)
                .satisfies(e -> assertThat(((ApiException) e).status()).isEqualTo(HttpStatus.FORBIDDEN));
        assertThat(users.findByEmail(admin.getEmail()).orElseThrow().getAuthProvider()).isEqualTo("LOCAL");
    }
}

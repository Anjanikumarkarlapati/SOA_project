package com.agritech.auth;

import com.agritech.common.ApiException;
import org.junit.jupiter.api.Test;
import org.mockito.InOrder;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.dao.DataAccessResourceFailureException;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * HTTP contract of the auth endpoints, with AuthService mocked: DB failures, duplicates and
 * validation all produce the shared error envelope, and no token is ever minted unless the
 * (mocked) persistence layer succeeded first.
 */
@WebMvcTest(AuthController.class)
@AutoConfigureMockMvc(addFilters = false)
class AuthControllerWebTest {

    @Autowired MockMvc mvc;
    @MockBean AuthService auth;
    @MockBean JwtService jwt;
    @MockBean TokenStore tokens;
    @MockBean SupabaseVerifier supabase;

    private static final String REGISTER_BODY = """
            {"email":"new@example.com","password":"password123","role":"FARMER","displayName":"New User"}
            """;

    private void stubSuccessfulLogin(User user) {
        when(auth.login(anyString(), anyString())).thenReturn(user);
        when(jwt.issue(any(User.class))).thenReturn("jwt-token");
        when(jwt.accessTtlSeconds()).thenReturn(900L);
        when(tokens.issueRefresh(anyString())).thenReturn("refresh-token");
    }

    @Test
    void registerReturnsTokenAndUserShape() throws Exception {
        User user = User.local("new@example.com", "hash", "FARMER", "FARM-AB12CD34", "New User");
        when(auth.register(anyString(), anyString(), any())).thenReturn(user);
        when(jwt.issue(any(User.class))).thenReturn("jwt-token");
        when(jwt.accessTtlSeconds()).thenReturn(900L);
        when(tokens.issueRefresh(anyString())).thenReturn("refresh-token");

        mvc.perform(post("/api/auth/register").contentType(MediaType.APPLICATION_JSON).content(REGISTER_BODY))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.token").value("jwt-token"))
                .andExpect(jsonPath("$.refreshToken").value("refresh-token"))
                .andExpect(jsonPath("$.email").value("new@example.com"))
                .andExpect(jsonPath("$.role").value("FARMER"))
                .andExpect(jsonPath("$.farmId").value("FARM-AB12CD34"));
    }

    /**
     * Regression: {@code POST /api/auth/register} used to accept the caller's role, so anyone
     * could ask for ADMIN on a public endpoint and get a real administrator session. The role is
     * now not even a parameter of the persistence call.
     */
    @Test
    void registeringWithRoleAdminStillYieldsFarmerAndNeverPassesTheRoleThrough() throws Exception {
        User farmer = User.local("new@example.com", "hash", "FARMER", "FARM-AB12CD34", "New User");
        when(auth.register(anyString(), anyString(), any())).thenReturn(farmer);
        when(jwt.issue(any(User.class))).thenReturn("jwt-token");
        when(jwt.accessTtlSeconds()).thenReturn(900L);
        when(tokens.issueRefresh(anyString())).thenReturn("refresh-token");

        mvc.perform(post("/api/auth/register").contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"email":"new@example.com","password":"password123",
                                 "role":"ADMIN","displayName":"New User"}
                                """))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.role").value("FARMER"));

        // Exactly the 3-argument overload: there is no way to hand a role to AuthService.register.
        verify(auth).register("new@example.com", "password123", "New User");
    }

    @Test
    void tokenIsIssuedOnlyAfterTheDbWriteSucceeds() throws Exception {
        // Ordering check: the mocked DB write must happen before the JWT is minted.
        User user = User.local("order@example.com", "hash", "FARMER", "FARM-1", null);
        stubSuccessfulLogin(user);

        mvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"order@example.com\",\"password\":\"password123\"}"))
                .andExpect(status().isOk());

        InOrder order = inOrder(auth, jwt);
        order.verify(auth).login("order@example.com", "password123");
        order.verify(jwt).issue(user);
    }

    @Test
    void dbFailureReturnsServerErrorAndNoTokenIsIssued() throws Exception {
        when(auth.login(anyString(), anyString()))
                .thenThrow(new DataAccessResourceFailureException("database is down"));

        ResultActions result = mvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON)
                .content("{\"email\":\"down@example.com\",\"password\":\"password123\"}"));

        result.andExpect(status().isInternalServerError())
                .andExpect(jsonPath("$.error").value("internal_error"))
                .andExpect(jsonPath("$.token").doesNotExist());
        verify(jwt, never()).issue(any(User.class));
        verify(tokens, never()).issueRefresh(anyString());
    }

    @Test
    void duplicateEmailRegisterReturnsConflict() throws Exception {
        when(auth.register(anyString(), anyString(), any()))
                .thenThrow(new ApiException(HttpStatus.CONFLICT, "email_taken",
                        "An account with that email already exists"));

        mvc.perform(post("/api/auth/register").contentType(MediaType.APPLICATION_JSON).content(REGISTER_BODY))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.error").value("email_taken"))
                .andExpect(jsonPath("$.token").doesNotExist());
    }

    @Test
    void invalidRegisterBodyIsRejectedWithValidationError() throws Exception {
        // Bad email + short password trip bean validation before any DB call.
        mvc.perform(post("/api/auth/register").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"not-an-email\",\"password\":\"short\",\"role\":\"FARMER\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").value("validation_error"));
        verify(auth, never()).register(anyString(), anyString(), any());
    }

    @Test
    void invalidCredentialsReturnUnauthorized() throws Exception {
        when(auth.login(anyString(), anyString()))
                .thenThrow(new ApiException(HttpStatus.UNAUTHORIZED, "invalid_credentials",
                        "Incorrect email or password"));

        mvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"x@example.com\",\"password\":\"password123\"}"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.error").value("invalid_credentials"));
    }

    @Test
    void revokedRequiresPrivilegedCallerAndMeRejectsRevokedJwt() throws Exception {
        mvc.perform(get("/api/auth/revoked")
                        .header("X-User-Role", "FARMER"))
                .andExpect(status().isForbidden());

        when(tokens.revokedIds()).thenReturn(java.util.Set.of("rev-1"));
        mvc.perform(get("/api/auth/revoked")
                        .header("X-User-Role", "SERVICE"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0]").value("rev-1"));

        io.jsonwebtoken.Claims claims = io.jsonwebtoken.Jwts.claims().setSubject("a@x.io").setId("rev-jti");
        claims.setExpiration(new java.util.Date(System.currentTimeMillis() + 60_000));
        when(jwt.parse("revoked-jwt")).thenReturn(claims);
        when(tokens.isRevoked("rev-jti")).thenReturn(true);

        mvc.perform(get("/api/auth/me").header("Authorization", "Bearer revoked-jwt"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.error").value("token_revoked"));
    }
}

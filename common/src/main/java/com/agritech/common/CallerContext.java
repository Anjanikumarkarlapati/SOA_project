package com.agritech.common;

import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.HttpStatus;

/**
 * Identity forwarded by the gateway after it validates the JWT. Downstream services
 * trust these headers because they only arrive through the gateway - the gateway strips any
 * client-supplied copies and re-signs what it forwards, and {@link InternalAuth} rejects a request
 * whose signature is missing or wrong.
 *
 * <p>Authentication is only half of it: every object in this platform belongs to a tenant (a
 * {@code farmId}), so a caller who is signed in still may not read or change another farm's
 * sensors, fields, schedules or valves. {@link #canAccess} and {@link #requireAccess} are the
 * single place that rule lives - see PRD 5.2 (multi-tenancy) and FR-2 (role separation).
 */
public final class CallerContext {

    public static final String EMAIL_HEADER = "X-User-Email";
    public static final String ROLE_HEADER = "X-User-Role";
    public static final String FARM_HEADER = "X-Farm-Id";

    public static final String ADMIN_ROLE = "ADMIN";
    public static final String FARMER_ROLE = "FARMER";

    private CallerContext() {}

    public static String email(HttpServletRequest req) { return req.getHeader(EMAIL_HEADER); }

    public static String role(HttpServletRequest req) {
        String role = req.getHeader(ROLE_HEADER);
        return role == null ? FARMER_ROLE : role;
    }

    public static String farmId(HttpServletRequest req) { return req.getHeader(FARM_HEADER); }

    public static boolean isAdmin(HttpServletRequest req) { return ADMIN_ROLE.equals(role(req)); }

    /** FR-2: administrator-only operations. */
    public static void requireAdmin(HttpServletRequest req) {
        if (!isAdmin(req)) {
            throw ApiException.forbidden("This action requires the administrator role");
        }
    }

    /**
     * The only two identities allowed to cross a tenant boundary: a platform administrator, and
     * another microservice calling through the gateway (east-west traffic has no single farm and
     * is already authenticated by {@link InternalAuth}).
     */
    public static boolean isPrivileged(HttpServletRequest req) {
        String role = role(req);
        return ADMIN_ROLE.equals(role) || InternalAuth.SERVICE_ROLE.equals(role);
    }

    /** The caller's tenant, or {@code null} when the identity carries no farm (anonymous, SERVICE). */
    public static String farmScope(HttpServletRequest req) {
        String farm = farmId(req);
        return farm == null || farm.isBlank() ? null : farm;
    }

    /** May this caller touch a resource owned by {@code resourceFarmId}? */
    public static boolean canAccess(HttpServletRequest req, String resourceFarmId) {
        if (isPrivileged(req)) return true;
        String mine = farmScope(req);
        return mine != null && mine.equals(resourceFarmId);
    }

    /**
     * Deny cross-tenant access. A foreign object answers 404, not 403: proving that an id exists
     * in another farm is itself a leak, and it is what lets ids be enumerated by brute force.
     */
    public static void requireAccess(HttpServletRequest req, String resourceFarmId, String what, String id) {
        if (!canAccess(req, resourceFarmId)) {
            throw ApiException.notFound(what, id);
        }
    }

    /**
     * Restrict a collection query to the caller's own tenant. Privileged callers see everything;
     * anyone else asking for a farm that is not theirs is silently narrowed to their own, so a
     * hand-crafted {@code ?farmId=} cannot be used to browse another farm's rows. Fails closed if
     * a non-privileged caller has no tenant claim.
     */
    public static String scopeListFilter(HttpServletRequest req, String requestedFarmId) {
        if (isPrivileged(req)) return requestedFarmId;
        String mine = farmScope(req);
        if (mine == null) {
            throw new ApiException(HttpStatus.UNAUTHORIZED, "unauthorized", "Missing tenant scope");
        }
        return mine;
    }
}

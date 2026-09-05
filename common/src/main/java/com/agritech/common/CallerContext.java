package com.agritech.common;

import jakarta.servlet.http.HttpServletRequest;

/**
 * Identity forwarded by the gateway after it validates the JWT. Downstream services
 * trust these headers because they are only reachable through the gateway; the gateway
 * strips any client-supplied copies.
 */
public final class CallerContext {

    public static final String EMAIL_HEADER = "X-User-Email";
    public static final String ROLE_HEADER = "X-User-Role";
    public static final String FARM_HEADER = "X-Farm-Id";

    private CallerContext() {}

    public static String email(HttpServletRequest req) { return req.getHeader(EMAIL_HEADER); }

    public static String role(HttpServletRequest req) {
        String role = req.getHeader(ROLE_HEADER);
        return role == null ? "FARMER" : role;
    }

    public static String farmId(HttpServletRequest req) { return req.getHeader(FARM_HEADER); }

    public static boolean isAdmin(HttpServletRequest req) { return "ADMIN".equals(role(req)); }

    /** FR-2: administrator-only operations. */
    public static void requireAdmin(HttpServletRequest req) {
        if (!isAdmin(req)) {
            throw ApiException.forbidden("This action requires the administrator role");
        }
    }
}

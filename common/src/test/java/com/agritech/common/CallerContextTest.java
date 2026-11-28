package com.agritech.common;

import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;

import static org.junit.jupiter.api.Assertions.*;

/**
 * The tenant rule every data service relies on: an identity may only reach objects on its own farm,
 * and the two privileged roles (ADMIN, SERVICE) are the only exceptions. This is the regression net
 * for the cross-tenant read/write access that used to be possible on every sensor, field, schedule
 * and valve.
 */
class CallerContextTest {

    private static MockHttpServletRequest caller(String email, String role, String farmId) {
        MockHttpServletRequest req = new MockHttpServletRequest("GET", "/api/sensors");
        req.addHeader(CallerContext.EMAIL_HEADER, email);
        req.addHeader(CallerContext.ROLE_HEADER, role);
        req.addHeader(CallerContext.FARM_HEADER, farmId);
        return req;
    }

    private static final MockHttpServletRequest FARMER_A = caller("a@x.io", "FARMER", "FARM-A");
    private static final MockHttpServletRequest FARMER_B = caller("b@x.io", "FARMER", "FARM-B");
    private static final MockHttpServletRequest ADMIN = caller("admin@x.io", "ADMIN", "FARM-A");
    private static final MockHttpServletRequest SERVICE = caller("service", "SERVICE", "");

    @Test
    void farmerSeesOnlyOwnFarm() {
        assertTrue(CallerContext.canAccess(FARMER_A, "FARM-A"));
        assertFalse(CallerContext.canAccess(FARMER_A, "FARM-B"));
    }

    @Test
    void adminAndServiceCrossTenants() {
        assertTrue(CallerContext.canAccess(ADMIN, "FARM-B"));
        assertTrue(CallerContext.canAccess(SERVICE, "FARM-B"));
        assertFalse(CallerContext.isPrivileged(FARMER_A), "a farmer is never privileged");
    }

    @Test
    void foreignObjectAnswersNotFoundNotForbidden() {
        // 404, not 403: a 403 confirms the id exists and invites enumeration.
        ApiException e = assertThrows(ApiException.class,
                () -> CallerContext.requireAccess(FARMER_A, "FARM-B", "Sensor device", "SENSOR-1"));
        assertEquals(404, e.status().value());
        assertEquals("not_found", e.code());
    }

    @Test
    void ownObjectIsNotRejected() {
        assertDoesNotThrow(() -> CallerContext.requireAccess(FARMER_A, "FARM-A", "Crop", "CROP-1"));
        assertDoesNotThrow(() -> CallerContext.requireAccess(ADMIN, "FARM-B", "Crop", "CROP-1"));
    }

    @Test
    void listFilterCannotBePointedAtAnotherFarm() {
        assertEquals("FARM-A", CallerContext.scopeListFilter(FARMER_A, "FARM-B"),
                "a farmer asking for FARM-B is narrowed to their own farm");
        assertEquals("FARM-A", CallerContext.scopeListFilter(FARMER_A, null),
                "no filter still means own farm, not every farm");
        assertEquals("FARM-B", CallerContext.scopeListFilter(ADMIN, "FARM-B"),
                "an administrator keeps the filter they asked for");
        assertNull(CallerContext.scopeListFilter(ADMIN, null), "an administrator with no filter is unscoped");
        assertNull(CallerContext.scopeListFilter(SERVICE, null), "a peer service stays unscoped");
    }

    @Test
    void blankFarmOnTheTokenIsNoScopeAtAll() {
        MockHttpServletRequest noFarm = caller("c@x.io", "FARMER", "  ");
        assertNull(CallerContext.farmScope(noFarm));
        assertFalse(CallerContext.canAccess(noFarm, "FARM-A"),
                "an identity without a tenant may not reach any object");
    }

    @Test
    void missingRoleDefaultsToFarmerNotAdmin() {
        MockHttpServletRequest req = new MockHttpServletRequest("GET", "/api/sensors");
        req.addHeader(CallerContext.EMAIL_HEADER, "d@x.io");
        assertEquals("FARMER", CallerContext.role(req));
        assertFalse(CallerContext.isAdmin(req));
        assertThrows(ApiException.class, () -> CallerContext.requireAdmin(req));
    }

    @Test
    void missingFarmScopeForNonPrivilegedCallerFailsClosed() {
        MockHttpServletRequest anon = caller("", "ANONYMOUS", "");
        ApiException e = assertThrows(ApiException.class, () -> CallerContext.scopeListFilter(anon, null));
        assertEquals(401, e.status().value());

        MockHttpServletRequest noFarmFarmer = caller("c@x.io", "FARMER", "");
        assertThrows(ApiException.class, () -> CallerContext.scopeListFilter(noFarmFarmer, null));
    }

    @Test
    void farmerCannotReachAnAdminOnlyOperation() {
        ApiException e = assertThrows(ApiException.class, () -> CallerContext.requireAdmin(FARMER_B));
        assertEquals(403, e.status().value());
        assertDoesNotThrow(() -> CallerContext.requireAdmin(ADMIN));
    }
}

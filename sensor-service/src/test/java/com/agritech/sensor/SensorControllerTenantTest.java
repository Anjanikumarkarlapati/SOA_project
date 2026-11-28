package com.agritech.sensor;

import com.agritech.common.ApiException;
import com.agritech.common.CallerContext;
import com.agritech.common.InternalAuth;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.data.domain.Sort;
import org.springframework.mock.web.MockHttpServletRequest;

import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Regression for the cross-tenant access that used to be possible on every sensor endpoint:
 * {@code GET /api/sensors} returned {@code findAll()} and {@code GET /api/sensors/{id}} never
 * looked at the caller at all, so one signed-in farmer could read the whole fleet.
 */
class SensorControllerTenantTest {

    private final SensorDeviceRepository devices = mock(SensorDeviceRepository.class);
    // DeviceSimulator is only touched by register(); these tests cover authorization on the
    // read paths, so it is not needed (and Mockito cannot proxy that class on this JVM).
    private final SensorController controller =
            new SensorController(devices, null, new ObjectMapper());

    private static SensorDevice device(String id, String farm) {
        return new SensorDevice(id, farm, "soil-moisture-temperature", "FIELD-" + farm, 18.5, 73.8);
    }

    private static MockHttpServletRequest caller(String role, String farm) {
        MockHttpServletRequest req = new MockHttpServletRequest("GET", "/api/sensors");
        req.addHeader(CallerContext.EMAIL_HEADER, "probe@example.test");
        req.addHeader(CallerContext.ROLE_HEADER, role);
        req.addHeader(CallerContext.FARM_HEADER, farm);
        return req;
    }

    @Test
    void farmerCannotReadAnotherFarmDeviceById() {
        when(devices.findById("SENSOR-B")).thenReturn(Optional.of(device("SENSOR-B", "FARM-B")));

        ApiException e = assertThrows(ApiException.class, () ->
                controller.get("SENSOR-B", caller("FARMER", "FARM-A")));
        assertEquals(404, e.status().value(), "another tenant's device must not be distinguishable from absent");
    }

    @Test
    void farmerReadsOwnDeviceById() {
        when(devices.findById("SENSOR-A")).thenReturn(Optional.of(device("SENSOR-A", "FARM-A")));
        assertEquals("SENSOR-A", controller.get("SENSOR-A", caller("FARMER", "FARM-A")).deviceId());
    }

    @Test
    void administratorStillSeesEveryFarm() {
        when(devices.findById("SENSOR-B")).thenReturn(Optional.of(device("SENSOR-B", "FARM-B")));
        assertEquals("SENSOR-B", controller.get("SENSOR-B", caller("ADMIN", "FARM-A")).deviceId());
    }

    @Test
    @SuppressWarnings("unchecked")
    void listIsScopedToTheCallersFarm() {
        when(devices.findByFarmId("FARM-A")).thenReturn(List.of(device("SENSOR-A", "FARM-A")));

        Map<String, Object> body = controller.list(0, 25, null, null, null, caller("FARMER", "FARM-A"));

        assertEquals("FARM-A", body.get("farmScope"));
        List<SensorController.SensorView> rows = (List<SensorController.SensorView>) body.get("content");
        assertEquals(1, rows.size());
        assertEquals("SENSOR-A", rows.get(0).deviceId());
        assertEquals(1, body.get("totalElements"));
    }

    @Test
    @SuppressWarnings("unchecked")
    void adminListIsUnscoped() {
        when(devices.findAll(any(Sort.class))).thenReturn(
                List.of(device("SENSOR-A", "FARM-A"), device("SENSOR-B", "FARM-B")));

        Map<String, Object> body = controller.list(0, 25, null, null, null, caller("ADMIN", "FARM-A"));

        assertEquals("ALL", body.get("farmScope"));
        assertEquals(2, ((List<SensorController.SensorView>) body.get("content")).size());
    }

    @Test
    void summaryCountsOnlyTheCallersFarm() {
        when(devices.findByFarmId("FARM-A")).thenReturn(List.of(device("SENSOR-A", "FARM-A")));

        Map<String, Object> summary = controller.summary(caller("FARMER", "FARM-A"));

        assertEquals(1, summary.get("total"), "a farmer's tile must not count other farms' probes");
    }

    @Test
    void deregisterRequiresAdmin() {
        ApiException e = assertThrows(ApiException.class, () ->
                controller.deregister("SENSOR-A", caller("FARMER", "FARM-A")));
        assertEquals(403, e.status().value());
    }

    @Test
    void serviceRoleCanDeregisterProvisionedSensor() {
        SensorDevice dev = device("SENSOR-A", "FARM-A");
        when(devices.findById("SENSOR-A")).thenReturn(Optional.of(dev));

        Map<String, String> res = controller.deregister("SENSOR-A", caller(InternalAuth.SERVICE_ROLE, ""));

        assertEquals("deregistered", res.get("status"));
        assertEquals("SENSOR-A", res.get("deviceId"));
        verify(devices).delete(dev);
    }
}

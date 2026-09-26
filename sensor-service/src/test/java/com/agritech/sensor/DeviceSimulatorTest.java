package com.agritech.sensor;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class DeviceSimulatorTest {

    @Test
    void newFieldGetsStableRandomBaselineInRange() {
        double[] a = DeviceSimulator.baseline("CROP-1A2B3C4D");
        assertArrayEquals(a, DeviceSimulator.baseline("CROP-1A2B3C4D"), "same field, same baseline");
        assertTrue(a[0] >= 25 && a[0] <= 80, "moisture");
        assertTrue(a[1] >= 16 && a[1] <= 30, "temperature");
        assertTrue(a[2] >= 5.6 && a[2] <= 7.4, "ph");
        assertEquals(62, DeviceSimulator.baseline("CROP-FIELD-01")[0], "seeded field keeps its baseline");
    }
}

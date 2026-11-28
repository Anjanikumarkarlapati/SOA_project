package com.agritech.sensor;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

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

    @Test
    void emitDoesNotSaveOrRecordWhenDeviceWasConcurrentlyDeleted() {
        SensorDeviceRepository devices = mock(SensorDeviceRepository.class);
        TelemetryRepository readings = mock(TelemetryRepository.class);
        FieldWateringRepository watering = mock(FieldWateringRepository.class);

        SensorDevice dev = new SensorDevice("SENSOR-RACE-1", "FARM-001", "soil-ph", "CROP-FIELD-01", 17.3, 78.4);
        when(watering.findAll()).thenReturn(List.of());
        when(devices.findAll()).thenReturn(List.of(dev));
        when(readings.findFirstByDeviceIdOrderByTimestampDesc("SENSOR-RACE-1")).thenReturn(Optional.empty());
        when(devices.touchReadingIfPresent(eq("SENSOR-RACE-1"), any(Instant.class))).thenReturn(0);

        DeviceSimulator sim = new DeviceSimulator(devices, readings, watering, new ObjectMapper(), true, 30_000);
        sim.emit();

        verify(devices, never()).save(any());
        verify(readings, never()).save(any());
    }
}

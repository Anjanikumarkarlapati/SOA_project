package com.agritech.crop;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

class PropertyRegistrationTest {
    private final FarmService service = new FarmService(null, null, null, null, null, null, null,
            new ObjectMapper());

    @Test
    void propertyStoresLocationWaterAndCropIntentSeparatelyFromProfileJson() {
        FarmProperty property = new FarmProperty("PROP-1", "farmer@example.test", "FIELD-1", "DEVICE-1", true);
        Map<String, Object> profile = new LinkedHashMap<>();
        profile.put("lat", 18.52);
        profile.put("lon", 73.85);
        profile.put("address", "Pune, Maharashtra");
        profile.put("boundaryGeoJson", "{\"type\":\"Polygon\",\"coordinates\":[[[73.8,18.5],[73.9,18.5],[73.9,18.6],[73.8,18.5]]]} ");
        profile.put("soilType", "black");
        profile.put("waterSource", "canal");
        profile.put("waterAvailability", "seasonal");
        profile.put("irrigationType", "drip");
        profile.put("cropIntent", "PLAN_DATES");
        profile.put("intendedSeason", "Kharif 2027");
        profile.put("intentStartDate", "2027-06-01");
        profile.put("intentEndDate", "2027-10-31");
        profile.put("previousCrops", List.of("rice", "chickpea"));

        property.update("Pune Farm", 4, "ACRES", "rice", "Maharashtra", "Pune",
                List.of("rainfall"), service.profileJson(profile), profile);

        assertEquals(18.52, property.getLatitude());
        assertEquals(73.85, property.getLongitude());
        assertEquals("Pune, Maharashtra", property.getAddress());
        assertTrue(property.getBoundaryGeoJson().contains("Polygon"));
        assertEquals("black", property.getSoilType());
        assertEquals("canal", property.getWaterDetails().getWaterSource());
        assertEquals("seasonal", property.getWaterDetails().getAvailability());
        assertEquals("drip", property.getWaterDetails().getIrrigationType());
        assertEquals("PLAN_DATES", property.getCropIntent().getIntent());
        assertEquals("Kharif 2027", property.getCropIntent().getSeason());
        assertEquals("rice,chickpea", property.getCropIntent().getPreviousCrops());
        assertFalse(property.getProfileJson().contains("boundaryGeoJson"));

        // Updating an existing property must mutate @MapsId children in place rather than replacing them.
        PropertyWaterDetails initialWater = property.getWaterDetails();
        PropertyCropIntent initialIntent = property.getCropIntent();
        profile.put("waterSource", "borewell");
        profile.put("cropIntent", "GROW_NOW");
        property.update("Pune Farm Updated", 5, "ACRES", "rice", "Maharashtra", "Pune",
                List.of("rainfall"), service.profileJson(profile), profile);

        assertSame(initialWater, property.getWaterDetails());
        assertSame(initialIntent, property.getCropIntent());
        assertEquals("borewell", property.getWaterDetails().getWaterSource());
        assertEquals("GROW_NOW", property.getCropIntent().getIntent());
    }

    @Test
    void rejectsCoordinatesOutsideLatitudeAndLongitudeRanges() {
        Map<String, Object> profile = new LinkedHashMap<>();
        profile.put("lat", 91);
        profile.put("lon", 73.85);
        assertThrows(RuntimeException.class, () -> service.profileJson(profile));
    }

    @Test
    void rejectsUnclosedGeoJsonPolygon() {
        Map<String, Object> profile = new LinkedHashMap<>();
        profile.put("boundaryGeoJson", "{\"type\":\"Polygon\",\"coordinates\":[[[73.8,18.5],[73.9,18.5],[73.9,18.6],[73.8,18.6]]]} ");
        assertThrows(RuntimeException.class, () -> service.profileJson(profile));
    }

    @Test
    void rejectsUnknownCropIntent() {
        Map<String, Object> profile = new LinkedHashMap<>();
        profile.put("cropIntent", "MAYBE");
        assertThrows(RuntimeException.class, () -> service.profileJson(profile));
    }
}

package com.agritech.crop;

import com.agritech.common.ApiException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.util.*;

/**
 * A user's farm: first-login setup, the live (simulated) sensor readings graded against the
 * crop, and the daily reports. Sensor data comes from sensor-service; this service owns the crop
 * knowledge, the grading and the reports.
 */
@Service
public class FarmService {

    private static final Logger log = LoggerFactory.getLogger(FarmService.class);

    /** Optional sensors a farmer can choose; the soil probe (moisture, soil temperature, pH) is always on. */
    static final List<String> SENSORS = List.of("air-temperature", "humidity", "light", "npk", "rainfall", "water-level");

    /** Farms are in India; a "day" for a report is an IST calendar day. */
    static final ZoneId FARM_TIME = ZoneId.of("Asia/Kolkata");

    /** Today's report is rebuilt from fresh readings at most this often. */
    static final Duration TODAY_REFRESH = Duration.ofMinutes(15);

    private final FarmPropertyRepository farms;
    private final FarmProfileRepository legacyFarms;
    private final DailyReportRepository reports;
    private final CropRepository crops;
    private final SensorClient sensors;
    private final PublicWeatherClient weather;
    private final CropAnalysisService analysis;
    private final ObjectMapper json;

    @Value("${agritech.jobs.enabled:true}")
    private boolean jobsEnabled = true;

    public FarmService(FarmPropertyRepository farms, FarmProfileRepository legacyFarms, DailyReportRepository reports, CropRepository crops,
                       SensorClient sensors, PublicWeatherClient weather, CropAnalysisService analysis, ObjectMapper json) {
        this.farms = farms;
        this.legacyFarms = legacyFarms;
        this.reports = reports;
        this.crops = crops;
        this.sensors = sensors;
        this.weather = weather;
        this.analysis = analysis;
        this.json = json;
    }

    public record Setup(String farmName, double landSize, String landUnit, String cropId, String state,
                        String district, List<String> sensors, Map<String, Object> profile) {}

    /* ---------- Setup ---------- */

    /** Creates the account's first property or updates its default property for older clients. */
    @Transactional
    public FarmProperty setup(String owner, String farmId, Setup req) {
        FarmProperty existing = find(owner).orElse(null);
        return saveSetup(owner, farmId, req, existing, existing == null);
    }

    /** Creates a second or later property without changing any property already registered. */
    @Transactional
    public FarmProperty createProperty(String owner, String farmId, Setup req) {
        boolean first = list(owner).isEmpty();
        return saveSetup(owner, farmId, req, null, first);
    }

    /** Updates one property after verifying that it belongs to the authenticated account. */
    @Transactional
    public FarmProperty updateProperty(String owner, String farmId, String propertyId, Setup req) {
        FarmProperty existing = find(owner, propertyId).orElseThrow(() -> ApiException.notFound("Property", propertyId));
        return saveSetup(owner, farmId, req, existing, false);
    }

    /** Deletes only the caller's property and its property-scoped data. */
    @Transactional
    public void deleteProperty(String owner, String propertyId) {
        FarmProperty property = find(owner, propertyId)
                .orElseThrow(() -> ApiException.notFound("Property", propertyId));
        List<FarmProperty> owned = list(owner);
        if (property.isDefaultProperty() && owned.size() > 1) {
            FarmProperty replacement = owned.stream().filter(p -> !p.getPropertyId().equals(propertyId))
                    .findFirst().orElseThrow();
            replacement.setDefaultProperty(true);
            farms.save(replacement);
        }
        reports.deleteByOwnerEmail(property.reportOwnerKey());
        crops.deleteById(property.getFieldId());
        farms.delete(property);
    }

    private FarmProperty saveSetup(String owner, String farmId, Setup req, FarmProperty existing, boolean defaultProperty) {
        CropCatalog.Spec spec = CropCatalog.find(req.cropId())
                .orElseThrow(() -> ApiException.badRequest("Unknown crop '" + req.cropId() + "'"));
        List<String> chosen = validSensors(req.sensors());
        String profileJson = profileJson(req.profile());
        double hectares = "ACRES".equals(req.landUnit()) ? req.landSize() / 2.47105 : req.landSize();
        String name = req.farmName().trim();

        FarmProperty farm = existing;
        if (farm == null) {
            String fieldId = Crop.newId();
            farm = new FarmProperty(fieldId, owner, fieldId, "SENSOR-" + fieldId, defaultProperty);
            crops.save(Crop.of(fieldId, farmId, name, spec, hectares));
            try {
                sensors.provisionFarmDevice(farm.getDeviceId(), fieldId, farmId, chosen, simProfile(spec, fieldId));
            } catch (Exception e) {
                log.warn("property setup for {} failed, sensor-service unavailable: {}", owner, e.getMessage());
                throw new ApiException(HttpStatus.SERVICE_UNAVAILABLE, "sensors_unavailable",
                        "The sensor service is not reachable, so your property was not saved. Please try again in a minute.");
            }
        } else {
            Crop field = crops.findById(farm.getFieldId())
                    .orElseThrow(() -> new IllegalStateException("property field missing: " + existing.getFieldId()));
            field.apply(name, spec, hectares);
            crops.save(field);
            boolean changed = !spec.id().equals(farm.getCropId()) || !chosen.equals(farm.sensorList());
            if (changed) {
                try {
                    sensors.updateFarmDevice(farm.getDeviceId(), chosen, simProfile(spec, farm.getFieldId()));
                } catch (Exception e) {
                    throw new ApiException(HttpStatus.SERVICE_UNAVAILABLE, "sensors_unavailable",
                            "The sensor service is not reachable, so your changes were not saved. Please try again.");
                }
            }
            reports.deleteByOwnerEmailAndReportDate(farm.reportOwnerKey(), LocalDate.now(FARM_TIME));
        }

        farm.update(name, req.landSize(), req.landUnit(), spec.id(), blankToNull(req.state()),
                blankToNull(req.district()), chosen, profileJson, req.profile());
        return farms.save(farm);
    }

    /**
     * Runs once the farm is committed (outside setup's transaction, so a failure here can never
     * undo the farm): the first health score for the operations screens, and the first reports -
     * yesterday's from the backfilled history, and today's so far. Best effort; anything missed
     * fills in on the next view or the nightly job.
     */
    public void warmUp(FarmProperty farm, boolean isNew) {
        crops.findById(farm.getFieldId()).ifPresent(field -> {
            try {
                if (isNew) analysis.backfillHistory(field);
                analysis.analyze(field);
            } catch (Exception e) {
                log.warn("first analysis for {} deferred: {}", field.getCropId(), e.getMessage());
            }
        });
        LocalDate today = LocalDate.now(FARM_TIME);
        for (LocalDate day : List.of(today.minusDays(1), today)) {
            try {
                generate(farm, day);
            } catch (Exception e) {
                log.warn("first {} report for {} deferred: {}", day, farm.getOwnerEmail(), e.getMessage());
            }
        }
    }

    private static List<String> validSensors(List<String> requested) {
        if (requested == null) return List.of();
        List<String> out = new ArrayList<>();
        for (String s : requested) {
            if (s == null || "soil".equals(s)) continue;
            if (!SENSORS.contains(s)) {
                throw ApiException.badRequest("Unknown sensor '" + s + "'. Choose from " + SENSORS);
            }
            if (!out.contains(s)) out.add(s);
        }
        out.sort(Comparator.naturalOrder());
        return out;
    }

    String profileJson(Map<String, Object> profile) {
        if (profile == null) return null;
        try {
            validateLocationAndIntent(profile);
            Map<String, Object> compact = new LinkedHashMap<>(profile);
            // Boundary is persisted in its own indexed property column, not duplicated in the
            // legacy assistant profile JSON (which intentionally remains small).
            compact.remove("boundaryGeoJson");
            String text = json.writeValueAsString(compact);
            if (text.length() > 8000) throw ApiException.badRequest("profile is too large");
            return text;
        } catch (ApiException e) {
            throw e;
        } catch (Exception e) {
            throw ApiException.badRequest("profile is not valid JSON");
        }
    }

    private void validateLocationAndIntent(Map<String, Object> profile) {
        Double lat = profile.get("lat") instanceof Number n ? n.doubleValue() : null;
        Double lon = profile.get("lon") instanceof Number n ? n.doubleValue() : null;
        if ((lat == null) != (lon == null) || (lat != null && (!Double.isFinite(lat) || lat < -90 || lat > 90))
                || (lon != null && (!Double.isFinite(lon) || lon < -180 || lon > 180))) {
            throw ApiException.badRequest("latitude and longitude must be valid coordinates");
        }
        String address = stringValue(profile.get("address"));
        if (address != null && address.length() > 500) throw ApiException.badRequest("address is too long");
        String boundary = stringValue(profile.get("boundaryGeoJson"));
        if (boundary != null) {
            if (boundary.length() > 100000) throw ApiException.badRequest("property boundary is too large");
            try {
                JsonNode polygon = json.readTree(boundary);
                JsonNode coordinates = polygon.path("coordinates").path(0);
                if (!"Polygon".equals(polygon.path("type").asText()) || !coordinates.isArray()
                        || coordinates.size() < 4
                        || !coordinates.get(0).equals(coordinates.get(coordinates.size() - 1))) {
                    throw ApiException.badRequest("boundary must be a closed GeoJSON Polygon");
                }
                for (JsonNode point : coordinates) {
                    if (!point.isArray() || point.size() != 2 || !point.get(0).isNumber() || !point.get(1).isNumber()
                            || point.get(0).doubleValue() < -180 || point.get(0).doubleValue() > 180
                            || point.get(1).doubleValue() < -90 || point.get(1).doubleValue() > 90) {
                        throw ApiException.badRequest("boundary coordinates are outside valid longitude/latitude ranges");
                    }
                }
            } catch (ApiException e) {
                throw e;
            } catch (Exception e) {
                throw ApiException.badRequest("boundaryGeoJson must contain a valid GeoJSON Polygon");
            }
        }
        String intent = stringValue(profile.get("cropIntent"));
        if (intent != null && !Set.of("GROW_NOW", "PLAN_DATES", "RECOMMEND_BEST").contains(intent)) {
            throw ApiException.badRequest("cropIntent must be GROW_NOW, PLAN_DATES, or RECOMMEND_BEST");
        }
        requireMaxLen(profile.get("soilType"), 60, "soilType");
        requireMaxLen(profile.get("waterSource"), 40, "waterSource");
        requireMaxLen(profile.get("waterAvailability"), 120, "waterAvailability");
        requireMaxLen(profile.get("irrigationType"), 40, "irrigationType");
        requireMaxLen(profile.get("intendedSeason"), 80, "intendedSeason");
        requireMaxLen(profile.get("intentStartDate"), 20, "intentStartDate");
        requireMaxLen(profile.get("intentEndDate"), 20, "intentEndDate");
        if (profile.get("previousCrops") instanceof java.util.Collection<?> list
                && String.join(",", list.stream().map(String::valueOf).toList()).length() > 1000) {
            throw ApiException.badRequest("previousCrops is too long");
        } else {
            requireMaxLen(profile.get("previousCrops"), 1000, "previousCrops");
        }
    }

    private static void requireMaxLen(Object value, int max, String field) {
        String s = stringValue(value);
        if (s != null && s.length() > max) {
            throw ApiException.badRequest(field + " must be at most " + max + " characters");
        }
    }

    private static String stringValue(Object value) {
        return value == null || String.valueOf(value).isBlank() ? null : String.valueOf(value);
    }

    /**
     * Simulation targets for a farm's device. Most farms sit near their crop's sweet spot, but each
     * drifts a little - seeded by the field id, so every farm is different and stays consistent -
     * and some drift out of range, as real fields do, which is what makes alerts appear.
     */
    static Map<String, Double> simProfile(CropCatalog.Spec spec, String fieldId) {
        long seed = Integer.toUnsignedLong(fieldId.hashCode());
        Random r = new Random(seed);
        double shift = r.nextGaussian() * 1.5;
        Map<String, Double> p = new LinkedHashMap<>();
        p.put("moisture", clamp(spec.moisture().mid() + r.nextGaussian() * 0.35 * spec.moisture().width(), 5, 98));
        p.put("tempMin", spec.temperature().min() + 1 + shift);
        p.put("tempMax", spec.temperature().max() - 1 + shift);
        p.put("humidity", clamp(spec.humidity().mid() + r.nextGaussian() * 0.3 * spec.humidity().width(), 20, 95));
        p.put("ph", clamp(spec.ph().mid() + r.nextGaussian() * 0.35 * spec.ph().width(), 3.5, 9.5));
        p.put("lightPeak", clamp(spec.light().mid() + r.nextGaussian() * 0.25 * spec.light().width(), 10000, 100000));
        p.put("nitrogen", Math.max(1, spec.n().mid() + r.nextGaussian() * 0.35 * spec.n().width()));
        p.put("phosphorus", Math.max(1, spec.p().mid() + r.nextGaussian() * 0.35 * spec.p().width()));
        p.put("potassium", Math.max(1, spec.k().mid() + r.nextGaussian() * 0.35 * spec.k().width()));
        p.put("rainChance", clamp((spec.humidity().mid() - 35) / 100, 0.08, 0.45));
        p.put("ponded", spec.ponded() ? 1.0 : 0.0);
        p.put("seed", (double) seed);
        return p;
    }

    public FarmProperty require(String owner) {
        return find(owner).orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "farm_not_set_up",
                "You have not set up a property yet."));
    }

    public FarmProperty require(String owner, String propertyId) {
        return find(owner, propertyId).orElseThrow(() -> ApiException.notFound("Property", propertyId));
    }

    public Optional<FarmProperty> find(String owner) {
        return list(owner).stream().filter(FarmProperty::isDefaultProperty).findFirst()
                .or(() -> list(owner).stream().findFirst());
    }

    public Optional<FarmProperty> find(String owner, String propertyId) {
        return list(owner).stream().filter(p -> p.getPropertyId().equals(propertyId)).findFirst();
    }

    /** List the caller's properties, lazily copying its old one-row profile on first access. */
    public List<FarmProperty> list(String owner) {
        List<FarmProperty> existing = farms.findByOwnerEmailOrderByDefaultPropertyDescCreatedAtAsc(owner);
        if (!existing.isEmpty()) return existing;
        Optional<FarmProfile> legacy = legacyFarms.findById(owner);
        if (legacy.isEmpty()) return List.of();
        try {
            farms.saveAndFlush(FarmProperty.fromLegacy(legacy.get()));
        } catch (DataIntegrityViolationException concurrentMigration) {
            // Another request for this account completed the one-time migration first.
        }
        return farms.findByOwnerEmailOrderByDefaultPropertyDescCreatedAtAsc(owner);
    }

    /** The farm with its newest reading, each sensor graded against the crop's range. */
    public Map<String, Object> view(FarmProperty farm) {
        CropCatalog.Spec spec = spec(farm);
        Map<String, Object> latest = sensors.deviceLatest(farm.getDeviceId());

        List<Map<String, Object>> readings = new ArrayList<>();
        for (ReportBuilder.Metric m : ReportBuilder.METRICS) {
            if (!ReportBuilder.enabled(m, farm.sensorList())) continue;
            CropCatalog.Range range = m.range().apply(spec);
            Object value = latest.get(m.key());
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("key", m.key());
            row.put("sensor", m.sensor());
            row.put("label", m.label());
            row.put("unit", m.unit());
            row.put("value", value instanceof Number n ? n.doubleValue() : null);
            row.put("optimalMin", range == null ? null : range.min());
            row.put("optimalMax", range == null ? null : range.max());
            // Light is graded on the day's peak, not an instant reading (it is 0 all night).
            row.put("status", value instanceof Number n && range != null && !"lightLux".equals(m.key())
                    ? ReportBuilder.grade(n.doubleValue(), range) : null);
            readings.add(row);
        }

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("simulated", true);
        out.put("dataSource", ReportBuilder.DATA_SOURCE);
        out.put("propertyId", farm.getPropertyId());
        out.put("farmName", farm.getFarmName());
        out.put("landSize", farm.getLandSize());
        out.put("landUnit", farm.getLandUnit());
        out.put("landHectares", Math.round(farm.hectares() * 100) / 100.0);
        out.put("cropId", spec.id());
        out.put("crop", spec.name());
        out.put("state", farm.getState());
        out.put("district", farm.getDistrict());
        out.put("sensors", farm.sensorList());
        out.put("fieldId", farm.getFieldId());
        out.put("deviceId", farm.getDeviceId());
        out.put("profile", parse(farm.getProfileJson()));
        out.put("latitude", farm.getLatitude());
        out.put("longitude", farm.getLongitude());
        out.put("address", farm.getAddress());
        out.put("boundaryGeoJson", farm.getBoundaryGeoJson());
        out.put("water", farm.getWaterDetails());
        out.put("cropIntent", farm.getCropIntent());
        out.put("readingAt", latest.get("timestamp"));
        out.put("readings", readings);
        out.put("createdAt", farm.getCreatedAt().toString());
        return out;
    }

    /* ---------- Daily reports ---------- */

    /** Today's report, rebuilt if older than TODAY_REFRESH; yesterday's if today has no data yet. */
    public DailyReport latest(FarmProperty farm) {
        LocalDate today = LocalDate.now(FARM_TIME);
        DailyReport report = current(farm, today);
        if ("NO_DATA".equals(report.getCondition())) {
            DailyReport yesterday = reportFor(farm, today.minusDays(1));
            if (!"NO_DATA".equals(yesterday.getCondition())) return yesterday;
        }
        return report;
    }

    /** The report for a given day: stored if final, rebuilt if it is today. */
    public DailyReport reportFor(FarmProperty farm, LocalDate date) {
        LocalDate today = LocalDate.now(FARM_TIME);
        if (date.isAfter(today)) throw ApiException.badRequest("No report for a future date");
        if (date.equals(today)) return current(farm, today);
        Optional<DailyReport> stored = reports.findByOwnerEmailAndReportDate(farm.reportOwnerKey(), date);
        if (stored.isPresent() && stored.get().isComplete() && hasWeather(stored.get())) return stored.get();
        // A past day not yet finalised (e.g. the service was down at midnight): build it now.
        LocalDate firstDay = farm.getCreatedAt().atZone(FARM_TIME).toLocalDate().minusDays(2);
        if (date.isBefore(firstDay)) throw ApiException.notFound("Report", date.toString());
        return generate(farm, date);
    }

    public List<DailyReport> history(FarmProperty farm) {
        return reports.findTop90ByOwnerEmailOrderByReportDateDesc(farm.reportOwnerKey());
    }

    private DailyReport current(FarmProperty farm, LocalDate today) {
        Optional<DailyReport> stored = reports.findByOwnerEmailAndReportDate(farm.reportOwnerKey(), today);
        Duration refreshAfter = stored.filter(r -> "NO_DATA".equals(r.getCondition()))
                .map(r -> Duration.ofSeconds(10)).orElse(TODAY_REFRESH);
        boolean fresh = stored.isPresent()
                && stored.get().getGeneratedAt().isAfter(Instant.now().minus(refreshAfter));
        if (fresh) return stored.get();
        try {
            return generate(farm, today);
        } catch (ApiException e) {
            // Sensor data unreachable: an older copy of today beats an error page.
            if (stored.isPresent()) return stored.get();
            throw e;
        }
    }

    /** Builds and stores the report for one IST calendar day from that day's readings. */
    DailyReport generate(FarmProperty farm, LocalDate date) {
        ZonedDateTime start = date.atStartOfDay(FARM_TIME);
        Instant now = Instant.now();
        Instant end = start.plusDays(1).toInstant();
        boolean complete = !now.isBefore(end);
        List<Map<String, Object>> readings;
        try {
            readings = sensors.deviceReadings(farm.getDeviceId(), start.toInstant(), complete ? end : now);
        } catch (Exception e) {
            log.warn("report for {} on {} deferred, sensor data unavailable: {}", farm.getOwnerEmail(), date, e.getMessage());
            throw new ApiException(HttpStatus.SERVICE_UNAVAILABLE, "sensors_unavailable",
                    "Sensor data is temporarily unavailable, so the report could not be built. Please try again shortly.");
        }

        CropCatalog.Spec spec = spec(farm);
        String location = farm.getDistrict() == null ? farm.getState()
                : farm.getState() == null ? farm.getDistrict() : farm.getDistrict() + ", " + farm.getState();
        ReportBuilder.FarmInfo info = new ReportBuilder.FarmInfo(farm.getFarmName(), farm.getLandSize(),
                farm.getLandUnit(), Math.round(farm.hectares() * 100) / 100.0, spec.name(), spec.id(),
                location, farm.sensorList());
        Map<String, Object> profile = parse(farm.getProfileJson());
        Double lat = coordinate(profile.get("lat"));
        Double lon = coordinate(profile.get("lon"));
        PublicWeatherClient.DailyWeather dailyWeather = lat == null || lon == null ? null
                : weather.daily(lat, lon, date).orElse(null);
        ReportBuilder.Report report = ReportBuilder.build(spec, info, date, complete, readings, dailyWeather);

        String payload;
        try {
            payload = json.writeValueAsString(report);
        } catch (Exception e) {
            throw new IllegalStateException("report not serialisable", e);
        }
        try {
            return save(farm.reportOwnerKey(), date, report, complete, payload);
        } catch (DataIntegrityViolationException race) {
            // A concurrent request inserted this day first; update theirs instead.
            return save(farm.reportOwnerKey(), date, report, complete, payload);
        }
    }

    private DailyReport save(String owner, LocalDate date, ReportBuilder.Report report, boolean complete, String payload) {
        DailyReport row = reports.findByOwnerEmailAndReportDate(owner, date)
                .orElseGet(() -> new DailyReport(owner, date));
        row.refresh(report.condition(), complete, payload);
        return reports.saveAndFlush(row);
    }

    /** Freezes yesterday's report for every farm shortly after midnight IST. */
    @Scheduled(cron = "${agritech.reports.cron:0 15 0 * * *}", zone = "Asia/Kolkata")
    public void finaliseYesterday() {
        if (!jobsEnabled) return;
        LocalDate yesterday = LocalDate.now(FARM_TIME).minusDays(1);
        for (FarmProperty farm : farms.findAll()) {
            try {
                generate(farm, yesterday);
            } catch (Exception e) {
                log.warn("could not finalise {} report for {}: {}", yesterday, farm.getOwnerEmail(), e.getMessage());
            }
        }
    }

    /** Report row as the API returns it: the stored report plus when it was built. */
    public Map<String, Object> asJson(DailyReport row) {
        Map<String, Object> out = new LinkedHashMap<>(parse(row.getPayload()));
        out.put("generatedAt", row.getGeneratedAt().toString());
        return out;
    }

    /* ---------- helpers ---------- */

    private static CropCatalog.Spec spec(FarmProperty farm) {
        return CropCatalog.find(farm.getCropId()).orElseGet(() -> CropCatalog.generic(farm.getCropId()));
    }

    private Map<String, Object> parse(String text) {
        if (text == null || text.isBlank()) return Map.of();
        try {
            return json.readValue(text, new TypeReference<Map<String, Object>>() {});
        } catch (Exception e) {
            return Map.of();
        }
    }

    private boolean hasWeather(DailyReport row) {
        return parse(row.getPayload()).get("weather") instanceof Map<?, ?> w && !w.isEmpty();
    }

    private static Double coordinate(Object value) {
        if (value instanceof Number n) return n.doubleValue();
        if (value instanceof String s) {
            try { return Double.parseDouble(s); } catch (NumberFormatException ignored) { return null; }
        }
        return null;
    }

    private static String blankToNull(String s) {
        return s == null || s.isBlank() ? null : s.trim();
    }

    private static double clamp(double v, double min, double max) {
        return Math.round(Math.max(min, Math.min(max, v)) * 100) / 100.0;
    }
}

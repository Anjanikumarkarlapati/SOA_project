package com.agritech.crop;

import com.agritech.common.ApiException;
import com.agritech.common.CallerContext;
import com.agritech.common.InternalAuth;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.time.format.DateTimeParseException;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * The signed-in user's own farm. Every endpoint is scoped to the caller's gateway-verified email,
 * so there is no farm id in the URL to tamper with.
 */
@RestController
@RequestMapping("/api/farm")
public class FarmController {

    private final FarmService farms;
    private final ClimateServiceClient climate;
    private final RecommendationServiceClient recommendations;

    public FarmController(FarmService farms, ClimateServiceClient climate, RecommendationServiceClient recommendations) {
        this.farms = farms;
        this.climate = climate;
        this.recommendations = recommendations;
    }

    public record SetupRequest(
            @NotBlank @Size(max = 80) String farmName,
            @NotNull @DecimalMin("0.01") @DecimalMax("100000") Double landSize,
            @NotBlank @Pattern(regexp = "ACRES|HECTARES", message = "must be ACRES or HECTARES") String landUnit,
            @NotBlank @Size(max = 40) String cropId,
            @Size(max = 60) String state,
            @Size(max = 60) String district,
            @NotNull @Size(max = 10) List<@NotBlank @Size(max = 40) String> sensors,
            Map<String, Object> profile) {}

    private static String owner(HttpServletRequest http) {
        String email = CallerContext.email(http);
        if (email == null || email.isBlank() || InternalAuth.SERVICE_ROLE.equals(CallerContext.role(http))) {
            throw new ApiException(HttpStatus.UNAUTHORIZED, "unauthorized", "Sign in to see your farm");
        }
        return email;
    }

    @GetMapping("/me")
    public ResponseEntity<Map<String, Object>> me(@RequestParam(required = false) String propertyId, HttpServletRequest http) {
        String owner = owner(http);
        Optional<FarmProperty> property = propertyId == null || propertyId.isBlank()
                ? farms.find(owner) : farms.find(owner, propertyId);
        return property.map(farm -> ResponseEntity.ok(farms.view(farm)))
                .orElseGet(() -> ResponseEntity.noContent().build());
    }

    /** First-login setup and the backwards-compatible default-property edit. */
    @PutMapping("/me")
    public Map<String, Object> setup(@Valid @RequestBody SetupRequest req, HttpServletRequest http) {
        String owner = owner(http);
        String farmId = Optional.ofNullable(CallerContext.farmId(http)).filter(f -> !f.isBlank()).orElse("FARM-001");
        boolean isNew = farms.find(owner).isEmpty();
        FarmProperty property = farms.setup(owner, farmId, new FarmService.Setup(req.farmName(), req.landSize(),
                req.landUnit(), req.cropId(), req.state(), req.district(), req.sensors(), req.profile()));
        farms.warmUp(property, isNew);
        return farms.view(property);
    }

/** All properties owned by the authenticated account. */
    @GetMapping("/properties")
    public List<Map<String, Object>> properties(HttpServletRequest http) {
        return farms.list(owner(http)).stream().map(this::propertySummary).toList();
    }

    @GetMapping("/properties/{propertyId}")
    public Map<String, Object> property(@PathVariable String propertyId, HttpServletRequest http) {
        return farms.view(farms.require(owner(http), propertyId));
    }

    /** Historical climate analytics for an owned property; a failed provider lookup is explicit and cached data may be served. */
    @GetMapping("/properties/{propertyId}/climate")
    public Map<String, Object> climate(@PathVariable String propertyId,
                                       @RequestParam(required = false) LocalDate start,
                                       @RequestParam(required = false) LocalDate end,
                                       HttpServletRequest http) {
        FarmProperty property = farms.require(owner(http), propertyId);
        if (property.getLatitude() == null || property.getLongitude() == null) {
            throw ApiException.badRequest("This property needs map coordinates before climate analytics can be loaded");
        }
        LocalDate to = end == null ? LocalDate.now().minusDays(5) : end;
        LocalDate from = start == null ? to.minusYears(10) : start;
        Map<String, Object> result = new LinkedHashMap<>(climate.historical(
                property.getLatitude(), property.getLongitude(), from, to));
        result.put("propertyId", propertyId);
        return result;
    }

    @GetMapping("/properties/{propertyId}/recommendations")
    public Map<String, Object> recommendations(@PathVariable String propertyId,
                                                @RequestParam(required = false) LocalDate start,
                                                @RequestParam(required = false) LocalDate end,
                                                HttpServletRequest http) {
        FarmProperty property = farms.require(owner(http), propertyId);
        return recommendations.recommend(property, start, end);
    }

    /** Register an additional property without modifying the default or any other property. */
    @PostMapping("/properties")
    @ResponseStatus(HttpStatus.CREATED)
    public Map<String, Object> createProperty(@Valid @RequestBody SetupRequest req, HttpServletRequest http) {
        String owner = owner(http);
        String farmId = Optional.ofNullable(CallerContext.farmId(http)).filter(f -> !f.isBlank()).orElse("FARM-001");
        FarmProperty property = farms.createProperty(owner, farmId, new FarmService.Setup(req.farmName(), req.landSize(),
                req.landUnit(), req.cropId(), req.state(), req.district(), req.sensors(), req.profile()));
        farms.warmUp(property, true);
        return farms.view(property);
    }

    /** Update only a property owned by the authenticated account. */
    @PutMapping("/properties/{propertyId}")
    public Map<String, Object> updateProperty(@PathVariable String propertyId,
                                               @Valid @RequestBody SetupRequest req,
                                               HttpServletRequest http) {
        String owner = owner(http);
        String farmId = Optional.ofNullable(CallerContext.farmId(http)).filter(f -> !f.isBlank()).orElse("FARM-001");
        FarmProperty property = farms.updateProperty(owner, farmId, propertyId,
                new FarmService.Setup(req.farmName(), req.landSize(), req.landUnit(), req.cropId(),
                        req.state(), req.district(), req.sensors(), req.profile()));
        farms.warmUp(property, false);
        return farms.view(property);
    }

    @DeleteMapping("/properties/{propertyId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteProperty(@PathVariable String propertyId, HttpServletRequest http) {
        farms.deleteProperty(owner(http), propertyId);
    }

    private Map<String, Object> propertySummary(FarmProperty property) {
        Map<String, Object> row = new LinkedHashMap<>();
        row.put("propertyId", property.getPropertyId());
        row.put("farmName", property.getFarmName());
        row.put("cropId", property.getCropId());
        row.put("state", property.getState());
        row.put("district", property.getDistrict());
        row.put("latitude", property.getLatitude());
        row.put("longitude", property.getLongitude());
        row.put("address", property.getAddress());
        row.put("landSize", property.getLandSize());
        row.put("landUnit", property.getLandUnit());
        row.put("soilType", property.getSoilType());
        row.put("water", property.getWaterDetails());
        row.put("cropIntent", property.getCropIntent());
        row.put("defaultProperty", property.isDefaultProperty());
        return row;
    }

    @GetMapping("/me/reports")
    public List<Map<String, Object>> reports(@RequestParam(required = false) String propertyId, HttpServletRequest http) {
        FarmProperty property = propertyId == null || propertyId.isBlank()
                ? farms.require(owner(http)) : farms.require(owner(http), propertyId);
        return farms.history(property).stream().map(r -> {
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("date", r.getReportDate().toString());
            row.put("condition", r.getCondition());
            row.put("conditionLabel", ReportBuilder.label(r.getCondition()));
            row.put("complete", r.isComplete());
            row.put("generatedAt", r.getGeneratedAt().toString());
            return row;
        }).toList();
    }

    @GetMapping("/me/reports/latest")
    public Map<String, Object> latest(@RequestParam(required = false) String propertyId, HttpServletRequest http) {
        FarmProperty property = propertyId == null || propertyId.isBlank()
                ? farms.require(owner(http)) : farms.require(owner(http), propertyId);
        return farms.asJson(farms.latest(property));
    }

    @GetMapping("/me/reports/{date}")
    public Map<String, Object> report(@PathVariable String date,
                                      @RequestParam(required = false) String propertyId,
                                      HttpServletRequest http) {
        FarmProperty property = propertyId == null || propertyId.isBlank()
                ? farms.require(owner(http)) : farms.require(owner(http), propertyId);
        LocalDate day;
        try {
            day = LocalDate.parse(date);
        } catch (DateTimeParseException e) {
            throw ApiException.badRequest("date must be YYYY-MM-DD");
        }
        return farms.asJson(farms.reportFor(property, day));
    }
}

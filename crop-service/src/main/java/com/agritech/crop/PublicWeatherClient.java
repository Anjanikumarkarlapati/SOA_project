package com.agritech.crop;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

/** Public, keyless weather data from Open-Meteo. Values are model-derived, never farm sensor readings. */
@Component
public class PublicWeatherClient {
    private static final Logger log = LoggerFactory.getLogger(PublicWeatherClient.class);
    private final HttpClient http = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(3)).build();
    private final ObjectMapper json;
    public PublicWeatherClient(ObjectMapper json) { this.json = json; }

    public record DailyWeather(String provider, String dataset, String retrievedAt, Double tempMaxC,
                               Double tempMinC, Double precipitationMm, Double et0Mm, Double sunshineHours,
                               String attribution) {}

    public Optional<DailyWeather> daily(double lat, double lon, LocalDate date) {
        if (!Double.isFinite(lat) || !Double.isFinite(lon) || lat < -90 || lat > 90 || lon < -180 || lon > 180
                || (lat == 0 && lon == 0)) return Optional.empty();
        try {
            String base = date.isBefore(LocalDate.now().minusDays(5))
                    ? "https://archive-api.open-meteo.com/v1/archive"
                    : "https://api.open-meteo.com/v1/forecast";
            String range = date.isBefore(LocalDate.now().minusDays(5))
                    ? "start_date=" + date + "&end_date=" + date
                    : "past_days=7&forecast_days=2";
            // Forecast endpoint returns a short recent history as well as today/tomorrow.
            if (!base.contains("archive") && date.isAfter(LocalDate.now().plusDays(1))) return Optional.empty();
            String query = "latitude=" + lat + "&longitude=" + lon + "&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,et0_fao_evapotranspiration,sunshine_duration&timezone=Asia%2FKolkata&" + range;
            URI uri = URI.create(base + "?" + query);
            HttpRequest request = HttpRequest.newBuilder(uri).timeout(Duration.ofSeconds(7)).header("Accept", "application/json").GET().build();
            HttpResponse<String> response = http.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() != 200) throw new IllegalStateException("weather API status " + response.statusCode());
            JsonNode root = json.readTree(response.body());
            JsonNode daily = root.path("daily");
            JsonNode times = daily.path("time");
            int index = -1;
            for (int i = 0; i < times.size(); i++) if (date.toString().equals(times.get(i).asText())) { index = i; break; }
            if (index < 0) return Optional.empty();
            String dataset = base.contains("archive") ? "Open-Meteo historical best-match reanalysis" : "Open-Meteo forecast / recent model data";
            return Optional.of(new DailyWeather("Open-Meteo", dataset, Instant.now().toString(),
                    number(daily, "temperature_2m_max", index), number(daily, "temperature_2m_min", index),
                    number(daily, "precipitation_sum", index), number(daily, "et0_fao_evapotranspiration", index),
                    divide(number(daily, "sunshine_duration", index), 3600.0),
                    "Weather data: Open-Meteo (open-meteo.com), CC BY 4.0. Model data, not on-farm observations."));
        } catch (Exception e) {
            log.warn("Open-Meteo lookup failed for {}, {}, {}: {}", lat, lon, date, e.getMessage());
            return Optional.empty();
        }
    }

    private static Double number(JsonNode parent, String key, int index) {
        JsonNode value = parent.path(key).path(index);
        return value.isNumber() ? value.doubleValue() : null;
    }
    private static Double divide(Double value, double divisor) { return value == null ? null : value / divisor; }
}

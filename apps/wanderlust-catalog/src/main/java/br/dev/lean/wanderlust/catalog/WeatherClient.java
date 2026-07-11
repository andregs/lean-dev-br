package br.dev.lean.wanderlust.catalog;

import java.net.http.HttpClient;
import java.util.List;
import java.util.stream.Collectors;

import org.jspecify.annotations.Nullable;
import org.springframework.aot.hint.MemberCategory;
import org.springframework.aot.hint.RuntimeHints;
import org.springframework.aot.hint.RuntimeHintsRegistrar;
import org.springframework.context.annotation.ImportRuntimeHints;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.client.JdkClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

/**
 * {@code @ImportRuntimeHints} is required under GraalVM native — see
 * {@code FeatureFlagsConfig}'s identical footgun: {@link OpenMeteoResponse} is only ever
 * deserialized by this manual {@code RestClient} call, never a controller type, so Spring's AOT
 * processing never discovers it and its record-accessor reflection is stripped from the native
 * image.
 */
@Component
@ImportRuntimeHints(WeatherClient.OpenMeteoResponseRuntimeHints.class)
class WeatherClient {

  private final RestClient http;
  private final String baseUrl;

  WeatherClient(CatalogProperties properties) {
    CatalogProperties.Weather weather = properties.weather();
    this.baseUrl = weather.baseUrl();
    var jdkHttpClient = HttpClient.newBuilder().connectTimeout(weather.connectTimeout()).build();
    var requestFactory = new JdkClientHttpRequestFactory(jdkHttpClient);
    requestFactory.setReadTimeout(weather.readTimeout());
    this.http = RestClient.builder().requestFactory(requestFactory).build();
  }

  /** One Open-Meteo call per destination — the N+1 path. */
  Weather fetchOne(double latitude, double longitude) {
    OpenMeteoResponse response = http.get()
        .uri(baseUrl + "?latitude={lat}&longitude={lon}&current=temperature_2m,weather_code",
            latitude, longitude)
        .retrieve()
        .body(OpenMeteoResponse.class);
    if (response == null || response.current() == null) {
      throw new IllegalStateException("Open-Meteo returned no current-weather block");
    }
    return new Weather(response.current().temperature2m(), response.current().weatherCode());
  }

  /** One Open-Meteo call for every destination — the batched fix for the N+1 path above. */
  List<Weather> fetchBatch(List<Coord> coords) {
    if (coords.isEmpty()) {
      return List.of();
    }
    if (coords.size() == 1) {
      // Open-Meteo returns a bare object (not a 1-element array) for a single coordinate,
      // even via this same comma-joined query shape — confirmed against the live API, not
      // assumed. Reuse fetchOne rather than special-case the array parsing below.
      Coord only = coords.get(0);
      return List.of(fetchOne(only.latitude(), only.longitude()));
    }
    String lats = coords.stream().map(c -> String.valueOf(c.latitude())).collect(Collectors.joining(","));
    String lons = coords.stream().map(c -> String.valueOf(c.longitude())).collect(Collectors.joining(","));

    List<OpenMeteoResponse> responses = http.get()
        .uri(baseUrl + "?latitude={lats}&longitude={lons}&current=temperature_2m,weather_code",
            lats, lons)
        .retrieve()
        .body(new ParameterizedTypeReference<List<OpenMeteoResponse>>() {});
    if (responses == null || responses.size() != coords.size()) {
      throw new IllegalStateException("Open-Meteo batch response size mismatch");
    }
    return responses.stream()
        .map(r -> new Weather(r.current().temperature2m(), r.current().weatherCode()))
        .toList();
  }

  static class OpenMeteoResponseRuntimeHints implements RuntimeHintsRegistrar {
    @Override
    public void registerHints(RuntimeHints hints, @Nullable ClassLoader classLoader) {
      hints.reflection().registerType(OpenMeteoResponse.class, MemberCategory.values());
      hints.reflection().registerType(OpenMeteoResponse.Current.class, MemberCategory.values());
    }
  }
}

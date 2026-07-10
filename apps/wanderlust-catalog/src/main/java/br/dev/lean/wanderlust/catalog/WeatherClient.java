package br.dev.lean.wanderlust.catalog;

import java.net.http.HttpClient;

import org.jspecify.annotations.Nullable;
import org.springframework.aot.hint.MemberCategory;
import org.springframework.aot.hint.RuntimeHints;
import org.springframework.aot.hint.RuntimeHintsRegistrar;
import org.springframework.context.annotation.ImportRuntimeHints;
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

  static class OpenMeteoResponseRuntimeHints implements RuntimeHintsRegistrar {
    @Override
    public void registerHints(RuntimeHints hints, @Nullable ClassLoader classLoader) {
      hints.reflection().registerType(OpenMeteoResponse.class, MemberCategory.values());
      hints.reflection().registerType(OpenMeteoResponse.Current.class, MemberCategory.values());
    }
  }
}

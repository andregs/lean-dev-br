package br.dev.lean.wanderlust.catalog;

import java.net.http.HttpClient;

import org.springframework.http.client.JdkClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

@Component
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
}

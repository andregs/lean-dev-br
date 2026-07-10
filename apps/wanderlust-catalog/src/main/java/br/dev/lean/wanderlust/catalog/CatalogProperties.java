package br.dev.lean.wanderlust.catalog;

import java.time.Duration;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * @param weather Open-Meteo aggregation settings.
 * @param flags   Feature-flag source — the same flagd-schema {@code flags.json} the JS apps read.
 */
@ConfigurationProperties(prefix = "catalog")
record CatalogProperties(Weather weather, Flags flags) {

  /**
   * @param baseUrl        Open-Meteo forecast endpoint.
   * @param connectTimeout Connect timeout for outbound weather calls.
   * @param readTimeout    Read timeout for outbound weather calls.
   */
  record Weather(String baseUrl, Duration connectTimeout, Duration readTimeout) {}

  /**
   * @param flagsUrl URL of the flagd-schema {@code flags.json} this service evaluates against.
   */
  record Flags(String flagsUrl) {}
}

package br.dev.lean.wanderlust.catalog;

import java.time.Duration;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * @param weather Open-Meteo client settings.
 * @param flags   Feature-flag source — the same flagd-schema {@code flags.json} the JS apps read.
 */
@ConfigurationProperties(prefix = "catalog")
record CatalogProperties(Weather weather, Flags flags) {

  /**
   * @param baseUrl            Open-Meteo forecast endpoint.
   * @param connectTimeout     Connect timeout for outbound weather calls.
   * @param readTimeout        Read timeout for outbound weather calls.
   * @param cacheTtl           How long a cached weather reading stays valid in Valkey.
   * @param cacheCoordPrecision Decimal places a coordinate is rounded to before it becomes a cache
   *                            key — collapses nearby lookups onto the same entry.
   */
  record Weather(
      String baseUrl,
      Duration connectTimeout,
      Duration readTimeout,
      Duration cacheTtl,
      int cacheCoordPrecision) {}

  /**
   * @param flagsUrl URL of the flagd-schema {@code flags.json} this service evaluates against.
   */
  record Flags(String flagsUrl) {}
}

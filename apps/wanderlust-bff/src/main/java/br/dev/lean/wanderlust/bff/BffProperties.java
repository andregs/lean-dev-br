package br.dev.lean.wanderlust.bff;

import java.time.Duration;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * @param catalog Upstream catalog service client settings.
 */
@ConfigurationProperties(prefix = "bff")
record BffProperties(Catalog catalog) {

  /**
   * @param baseUrl        catalog service's REST base URL. Temporary — replaced by a gRPC client
   *                       once catalog exposes one.
   * @param connectTimeout Connect timeout for the catalog call.
   * @param readTimeout    Read timeout for the catalog call.
   */
  record Catalog(String baseUrl, Duration connectTimeout, Duration readTimeout) {}
}

package br.dev.lean.relay;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;

/**
 * OTLP exporter settings not covered by Spring's own
 * {@code management.opentelemetry.*} properties (e.g. the endpoint).
 *
 * @param otlp OTLP exporter settings.
 */
@ConfigurationProperties(prefix = "otel")
record OtelProperties(Otlp otlp) {

  /**
   * @param authorization Raw {@code Authorization} header value (e.g.
   *                       {@code Basic <base64>}) for Grafana Cloud's OTLP
   *                       gateway — Spring has no declarative property for
   *                       custom export headers. Bind from the
   *                       {@code OTEL_OTLP_AUTHORIZATION} environment variable
   *                       in prod. Blank (default) → no header is sent.
   */
  record Otlp(@DefaultValue("") String authorization) {
  }
}

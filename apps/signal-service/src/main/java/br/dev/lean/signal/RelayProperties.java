package br.dev.lean.signal;

import java.time.Duration;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;

/**
 * Configuration properties for the Yjs update relay.
 *
 * @param cors               CORS settings for {@code /rooms/**} endpoints.
 * @param roomTtl            How long a room stays alive after its last read or write before being
 *                           evicted. Accepts standard Spring duration notation — e.g. {@code 5m},
 *                           {@code 300s}, {@code PT5M}. Default: {@code 5m}.
 * @param maxUpdatesPerRoom  Maximum number of encrypted blobs a single room may accumulate
 *                           before POST returns HTTP 413. Keeps heap bounded under abuse.
 *                           Default: {@code 1000}.
 */
@ConfigurationProperties(prefix = "relay")
record RelayProperties(
    Cors cors,
    @DefaultValue("5m") Duration roomTtl,
    @DefaultValue("1000") int maxUpdatesPerRoom) {

  /**
   * @param allowedOrigins Comma-separated CORS allowed origins for {@code /rooms/**}.
   *                       Use {@code *} to allow all origins (suitable for local dev and
   *                       public read-only signal endpoints where the payload is already E2EE).
   */
  record Cors(String[] allowedOrigins) {}
}

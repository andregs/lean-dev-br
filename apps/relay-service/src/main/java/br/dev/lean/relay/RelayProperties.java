package br.dev.lean.relay;

import java.time.Duration;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;

/**
 * Configuration properties for the Yjs update relay.
 *
 * @param cors              CORS settings for {@code /rooms/**} endpoints.
 * @param roomTtl           How long a room stays alive after its last read or
 *                          write before being
 *                          evicted. Accepts standard Spring duration notation —
 *                          e.g. {@code 5m},
 *                          {@code 300s}, {@code PT5M}. Default: {@code 5m}.
 * @param maxUpdatesPerRoom Maximum number of encrypted blobs a single room may
 *                          accumulate
 *                          before POST returns HTTP 413. Keeps heap bounded
 *                          under abuse.
 *                          Default: {@code 1000}.
 * @param pruneToken        Shared secret required in the {@code X-Prune-Token}
 *                          header on {@code POST /internal/prune}. Bind from
 *                          the {@code PRUNE_TOKEN} environment variable in prod.
 *                          Blank (default) → endpoint always returns 403.
 */
@ConfigurationProperties(prefix = "relay")
record RelayProperties(
    Cors cors,
    @DefaultValue("5m") Duration roomTtl,
    @DefaultValue("1000") int maxUpdatesPerRoom,
    @DefaultValue("") String pruneToken) {

  /**
   * @param allowedOrigins Comma-separated CORS allowed origins for
   *                       {@code /rooms/**}.
   *                       Use {@code *} to allow all origins (suitable for local
   *                       dev and
   *                       public read-only relay endpoints where the payload is
   *                       already E2EE).
   */
  record Cors(String[] allowedOrigins) {
  }
}

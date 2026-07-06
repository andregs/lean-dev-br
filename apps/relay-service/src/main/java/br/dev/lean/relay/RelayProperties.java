package br.dev.lean.relay;

import java.time.Duration;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * Configuration properties for the Yjs update relay. No hard-coded defaults —
 * missing config should break loudly, not run with a wrong assumption.
 * {@code maxUpdatesPerRoom} (primitive) fails app startup if unbound;
 * {@code roomTtl}/{@code pruneToken} bind to {@code null} if unbound and fail
 * on first use instead.
 *
 * @param cors              CORS settings for {@code /rooms/**} endpoints.
 * @param roomTtl           How long a room stays alive after its last read or
 *                          write before being evicted. Accepts standard
 *                          Spring duration notation — e.g. {@code 5m},
 *                          {@code 300s}, {@code PT5M}.
 * @param maxUpdatesPerRoom Maximum number of encrypted blobs a single room may
 *                          accumulate before POST returns HTTP 413. Keeps
 *                          heap bounded under abuse.
 * @param pruneToken        Shared secret required in the {@code X-Prune-Token}
 *                          header on {@code POST /internal/prune}. Bind from
 *                          the {@code RELAY_PRUNETOKEN} environment variable
 *                          (relaxed binding: prefix "relay" + field
 *                          "pruneToken").
 */
@ConfigurationProperties(prefix = "relay")
record RelayProperties(
    Cors cors,
    Duration roomTtl,
    int maxUpdatesPerRoom,
    String pruneToken) {

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

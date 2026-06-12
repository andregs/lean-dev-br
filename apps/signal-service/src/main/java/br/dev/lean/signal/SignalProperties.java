package br.dev.lean.signal;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "signal")
record SignalProperties(Cors cors) {
  /**
   * @param allowedOrigins Comma-separated CORS allowed origins for `/signal/**`.
   */
  record Cors(
      String[] allowedOrigins) {
  }
}

package br.dev.lean.relay;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.InitializingBean;
import org.springframework.boot.micrometer.tracing.opentelemetry.autoconfigure.otlp.OtlpTracingProperties;
import org.springframework.stereotype.Component;

/**
 * Logs the bound OTLP tracing config at startup — endpoint and whether the
 * Authorization header actually bound to something (length only, never the
 * secret itself) — since "config looks right in Pulumi/infra" and "config
 * actually bound in the running app" turned out to be worth distinguishing.
 */
@Component
class OtelDiagnostics implements InitializingBean {

  private static final Logger log = LoggerFactory.getLogger(OtelDiagnostics.class);

  private final OtlpTracingProperties otlpProperties;

  OtelDiagnostics(OtlpTracingProperties otlpProperties) {
    this.otlpProperties = otlpProperties;
  }

  @Override
  public void afterPropertiesSet() {
    // Map<String,String> properties bind env var keys lowercased
    // (RELAXED_binding turns ..._AUTHORIZATION into map key "authorization",
    // not "Authorization") — case-insensitive lookup here to not repeat that
    // mistake in the diagnostic itself.
    var authorization =
        otlpProperties.getHeaders().entrySet().stream()
            .filter((e) -> e.getKey().equalsIgnoreCase("Authorization"))
            .map((e) -> e.getValue())
            .findFirst()
            .orElse(null);
    log.info(
        "OTLP tracing config: endpoint={} headers={} authorizationLength={}",
        otlpProperties.getEndpoint(),
        otlpProperties.getHeaders().keySet(),
        authorization == null ? "null" : authorization.length());
  }
}

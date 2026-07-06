package br.dev.lean.relay;

import org.springframework.boot.micrometer.tracing.opentelemetry.autoconfigure.otlp.OtlpHttpSpanExporterBuilderCustomizer;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * Grafana Cloud's OTLP gateway requires Basic-auth. Spring Boot has no
 * declarative property for custom OTLP export headers — this is the
 * officially documented extension point instead.
 */
@Configuration
class OtelTracingConfig {

  private final OtelProperties props;

  OtelTracingConfig(OtelProperties props) {
    this.props = props;
  }

  @Bean
  OtlpHttpSpanExporterBuilderCustomizer otlpAuthorizationCustomizer() {
    return builder -> {
      String authorization = props.otlp().authorization();
      if (!authorization.isBlank()) {
        builder.addHeader("Authorization", authorization);
      }
    };
  }
}

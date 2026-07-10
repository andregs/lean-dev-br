package br.dev.lean.wanderlust.catalog;

import java.util.List;

import org.springframework.boot.micrometer.tracing.opentelemetry.autoconfigure.otlp.OtlpTracingProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import io.opentelemetry.exporter.otlp.http.trace.OtlpHttpSpanExporter;
import io.opentelemetry.sdk.trace.export.BatchSpanProcessor;
import io.opentelemetry.sdk.trace.export.SpanExporter;

/**
 * Registers an unconditional {@link BatchSpanProcessor} instead of relying on Spring's own
 * auto-configured span-processor bean, which is gated on {@code @ConditionalOnProperty} —
 * Spring's AOT engine evaluates that at native-image *build* time, and our OTLP endpoint is only
 * ever a runtime env var, so the real exporter would be silently excluded from every native
 * image. This bean does the endpoint presence check as a plain runtime {@code if} instead. See
 * relay-service's identically-named class for the fuller investigation.
 */
@Configuration
class DirectOtlpTracingConfig {

  @Bean
  BatchSpanProcessor directOtlpSpanProcessor(OtlpTracingProperties props) {
    String endpoint = props.getEndpoint();
    SpanExporter exporter =
        (endpoint == null || endpoint.isBlank())
            ? SpanExporter.composite(List.of())
            : buildOtlpExporter(props, endpoint);
    return BatchSpanProcessor.builder(exporter).build();
  }

  private static SpanExporter buildOtlpExporter(OtlpTracingProperties props, String endpoint) {
    var builder = OtlpHttpSpanExporter.builder().setEndpoint(endpoint);
    props.getHeaders().forEach(builder::addHeader);
    return builder.build();
  }
}

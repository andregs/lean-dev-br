package br.dev.lean.relay;

import java.util.List;

import org.springframework.boot.micrometer.tracing.opentelemetry.autoconfigure.otlp.OtlpTracingProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import io.opentelemetry.exporter.otlp.http.trace.OtlpHttpSpanExporter;
import io.opentelemetry.sdk.trace.export.BatchSpanProcessor;
import io.opentelemetry.sdk.trace.export.SpanExporter;

/**
 * Registers a {@link BatchSpanProcessor} wrapping a directly-built OTLP
 * exporter. Spring's own equivalent bean
 * ({@code OpenTelemetryTracingAutoConfiguration.otelSpanProcessor}) wraps the
 * exporter in Micrometer's {@code CompositeSpanExporter} — and, on closer
 * inspection, was never actually reachable under GraalVM native at all: its
 * whole chain is gated on {@code @ConditionalOnProperty("...otlp.endpoint")},
 * and Spring's AOT engine evaluates conditional-bean annotations at *build*
 * time, baking the result into the native image. Our endpoint is only ever
 * set via a Cloud Run runtime env var — never present during the CI build —
 * so that condition was always false at AOT time and the real exporter bean
 * was silently excluded from every native image we shipped. Confirmed by
 * inspecting the AOT-generated bean-definitions source: no entry existed for
 * it at all.
 *
 * <p>
 * The fix has to avoid conditional-bean annotations entirely for anything
 * gated on a runtime-only property — do the presence check as a plain
 * runtime {@code if} inside an unconditionally-registered bean instead.
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

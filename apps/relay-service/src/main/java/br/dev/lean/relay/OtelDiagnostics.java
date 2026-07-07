package br.dev.lean.relay;

import java.util.concurrent.atomic.AtomicInteger;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.InitializingBean;
import org.springframework.boot.micrometer.tracing.opentelemetry.autoconfigure.SdkTracerProviderBuilderCustomizer;
import org.springframework.boot.micrometer.tracing.opentelemetry.autoconfigure.otlp.OtlpTracingProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.stereotype.Component;

import io.opentelemetry.context.Context;
import io.opentelemetry.sdk.common.CompletableResultCode;
import io.opentelemetry.sdk.trace.ReadWriteSpan;
import io.opentelemetry.sdk.trace.ReadableSpan;
import io.opentelemetry.sdk.trace.data.SpanData;
import io.opentelemetry.sdk.trace.export.SpanExporter;

/**
 * Logs the bound OTLP tracing config at startup — endpoint and whether the
 * Authorization header actually bound to something (length only, never the
 * secret itself) — since "config looks right in Pulumi/infra" and "config
 * actually bound in the running app" turned out to be worth distinguishing.
 *
 * <p>
 * Also registers a second, fully independent SpanProcessor (via the
 * documented SdkTracerProviderBuilderCustomizer hook — purely additive,
 * doesn't touch the real auto-configured exporter) whose only job is to log
 * onStart/onEnd/export details directly via SLF4J. This proves whether real
 * span data reaches the pipeline at all, decoupled from whether the real
 * export to Grafana actually succeeds.
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

  @Configuration
  static class DiagnosticSpanProcessorConfig {

    @Bean
    SdkTracerProviderBuilderCustomizer diagnosticSpanProcessorCustomizer() {
      return (builder) -> builder.addSpanProcessor(new DiagnosticSpanProcessor());
    }
  }

  private static final class DiagnosticSpanProcessor
      implements io.opentelemetry.sdk.trace.SpanProcessor {

    private static final Logger log = LoggerFactory.getLogger(DiagnosticSpanProcessor.class);
    private final DiagnosticSpanExporter exporter = new DiagnosticSpanExporter();

    @Override
    public void onStart(Context parentContext, ReadWriteSpan span) {
      log.info(
          "diag onStart: traceId={} spanId={} name={}",
          span.getSpanContext().getTraceId(),
          span.getSpanContext().getSpanId(),
          span.getName());
    }

    @Override
    public boolean isStartRequired() {
      return true;
    }

    @Override
    public void onEnd(ReadableSpan span) {
      log.info(
          "diag onEnd: traceId={} spanId={} name={} sampled={}",
          span.getSpanContext().getTraceId(),
          span.getSpanContext().getSpanId(),
          span.getName(),
          span.getSpanContext().isSampled());
      exporter.export(java.util.List.of(span.toSpanData()));
    }

    @Override
    public boolean isEndRequired() {
      return true;
    }

    @Override
    public CompletableResultCode forceFlush() {
      log.info("diag forceFlush called");
      return CompletableResultCode.ofSuccess();
    }

    @Override
    public CompletableResultCode shutdown() {
      return CompletableResultCode.ofSuccess();
    }
  }

  /** Logging-only — never actually sends anywhere, just proves data reaches this point. */
  private static final class DiagnosticSpanExporter implements SpanExporter {

    private static final Logger log = LoggerFactory.getLogger(DiagnosticSpanExporter.class);
    private final AtomicInteger exportCount = new AtomicInteger();

    @Override
    public CompletableResultCode export(java.util.Collection<SpanData> spans) {
      int n = exportCount.incrementAndGet();
      log.info(
          "diag export #{}: {} span(s), traceIds={}",
          n,
          spans.size(),
          spans.stream().map((s) -> s.getTraceId()).toList());
      return CompletableResultCode.ofSuccess();
    }

    @Override
    public CompletableResultCode flush() {
      return CompletableResultCode.ofSuccess();
    }

    @Override
    public CompletableResultCode shutdown() {
      return CompletableResultCode.ofSuccess();
    }
  }
}

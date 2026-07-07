package br.dev.lean.relay;

import java.util.concurrent.atomic.AtomicInteger;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.InitializingBean;
import org.springframework.boot.micrometer.tracing.opentelemetry.autoconfigure.SdkTracerProviderBuilderCustomizer;
import org.springframework.boot.micrometer.tracing.opentelemetry.autoconfigure.otlp.OtlpTracingProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.env.Environment;
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
 * Also registers a second, fully independent SpanProcessor (via the
 * documented SdkTracerProviderBuilderCustomizer hook — purely additive,
 * doesn't touch the real exporter) logging onStart/onEnd/export directly via
 * SLF4J. This proved whether real span data reaches the pipeline at all,
 * decoupled from whether the real export succeeds — what actually found
 * today's real bug (see DirectOtlpTracingConfig).
 *
 * <p>
 * Off by default — flip {@code relay.diagnostics.otel-enabled} (env var
 * {@code RELAY_DIAGNOSTICS_OTELENABLED=true}, no redeploy needed) to
 * re-diagnose. Deliberately <b>not</b> gated via {@code @ConditionalOnProperty}
 * — that annotation is evaluated by Spring's AOT engine at native-image
 * *build* time, and this property is only ever set via a runtime env var, so
 * a build-time condition would exclude these beans permanently regardless of
 * what's set at runtime (this exact mistake is what caused today's bug in
 * the first place). The bean stays unconditionally registered; the flag is
 * checked live via {@link Environment} instead.
 */
@Component
class OtelDiagnostics implements InitializingBean {

  private static final Logger log = LoggerFactory.getLogger(OtelDiagnostics.class);

  private final OtlpTracingProperties otlpProperties;
  private final io.opentelemetry.sdk.trace.SdkTracerProvider tracerProvider;
  private final java.util.List<SpanExporter> spanExporters;
  private final Environment env;

  OtelDiagnostics(
      OtlpTracingProperties otlpProperties,
      io.opentelemetry.sdk.trace.SdkTracerProvider tracerProvider,
      java.util.List<SpanExporter> spanExporters,
      Environment env) {
    this.otlpProperties = otlpProperties;
    this.tracerProvider = tracerProvider;
    this.spanExporters = spanExporters;
    this.env = env;
  }

  private static boolean enabled(Environment env) {
    return env.getProperty("relay.diagnostics.otel-enabled", Boolean.class, false);
  }

  @Override
  public void afterPropertiesSet() {
    if (!enabled(env)) return;
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
    // Injecting SdkTracerProvider as a bean dependency forces Spring to fully
    // build it (with all its registered span processors) before this runs —
    // toString() reveals exactly what's registered, including the real
    // exporter's own toString (endpoint, etc).
    log.info("SdkTracerProvider: {}", tracerProvider);
    // CompositeSpanExporter (the real exporter's actual wrapper) doesn't
    // override toString(), so it hides whether it actually wraps our OTLP
    // exporter or nothing at all — checking the raw SpanExporter beans
    // Spring sees cuts through that opacity directly.
    log.info(
        "SpanExporter beans ({}): {}",
        spanExporters.size(),
        spanExporters.stream().map((e) -> e.getClass().getName()).toList());
  }

  @Configuration
  static class DiagnosticSpanProcessorConfig {

    @Bean
    SdkTracerProviderBuilderCustomizer diagnosticSpanProcessorCustomizer(Environment env) {
      return (builder) -> {
        if (enabled(env)) {
          builder.addSpanProcessor(new DiagnosticSpanProcessor());
        }
      };
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

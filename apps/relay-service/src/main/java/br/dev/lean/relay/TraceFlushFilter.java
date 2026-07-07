package br.dev.lean.relay;

import java.io.IOException;
import java.util.concurrent.TimeUnit;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import io.opentelemetry.sdk.trace.SdkTracerProvider;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

/**
 * Cloud Run only allocates CPU while a request is being handled ({@code
 * cpuIdle: true} in infra) — the OTel SDK's own BatchSpanProcessor exports on
 * a background timer that may never get scheduled between requests, so spans
 * can sit in the queue and never ship. Flush synchronously here instead,
 * still within the request's guaranteed CPU window.
 */
@Component
class TraceFlushFilter extends OncePerRequestFilter {

  private static final Logger log = LoggerFactory.getLogger(TraceFlushFilter.class);

  private final SdkTracerProvider tracerProvider;

  TraceFlushFilter(SdkTracerProvider tracerProvider) {
    this.tracerProvider = tracerProvider;
  }

  @Override
  protected void doFilterInternal(
      HttpServletRequest request, HttpServletResponse response, FilterChain chain)
      throws ServletException, IOException {
    try {
      chain.doFilter(request, response);
    } finally {
      try {
        tracerProvider.forceFlush().join(2, TimeUnit.SECONDS);
      } catch (Exception e) {
        log.warn("Trace flush failed (non-fatal)", e);
      }
    }
  }
}

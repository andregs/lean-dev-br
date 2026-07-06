// @ts-check
// Manual OTel setup — no auto-instrumentation. contact-api is esbuild-bundled
// (thirdParty: true, single file); require-hook-based auto-instrumentation
// can't patch code already inlined into one file. The AWS ADOT Lambda Layer
// (the usual auto-instrumentation path) would work around that, but it ships
// its own embedded OTel Collector defaulting to X-Ray — redirecting it to
// Grafana needs a bundled collector-config file + a Layer ARN to track, a
// real new moving part. For a function this small (one handler, two external
// calls: SES + reCAPTCHA fetch), manual spans are less total surface.
import { context, propagation, trace, SpanKind, SpanStatusCode } from '@opentelemetry/api';
import { logs, SeverityNumber } from '@opentelemetry/api-logs';
import type { AnyValueMap } from '@opentelemetry/api-logs';
import { OTLPLogExporter } from '@opentelemetry/exporter-logs-otlp-http';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { BatchLogRecordProcessor, LoggerProvider } from '@opentelemetry/sdk-logs';
import { BatchSpanProcessor } from '@opentelemetry/sdk-trace-base';
import { NodeTracerProvider } from '@opentelemetry/sdk-trace-node';
import {
  ATTR_DEPLOYMENT_ENVIRONMENT_NAME,
  ATTR_SERVICE_NAME,
  ATTR_SERVICE_NAMESPACE,
} from '@opentelemetry/semantic-conventions';
import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';

/** OTEL_EXPORTER_OTLP_HEADERS is "Key=Value,Key2=Value2" (comma-separated pairs). */
function parseOtlpHeaders(raw: string | undefined): Record<string, string> {
  const headers: Record<string, string> = {};
  if (!raw) return headers;
  for (const pair of raw.split(',')) {
    const idx = pair.indexOf('=');
    if (idx === -1) continue;
    headers[pair.slice(0, idx).trim()] = pair.slice(idx + 1).trim();
  }
  return headers;
}

const endpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT;
const headers = parseOtlpHeaders(process.env.OTEL_EXPORTER_OTLP_HEADERS);

// service.name must be a resource attribute, not a per-log attribute — logs
// with service.name set the wrong way show up as "unknown_service" in Loki.
const resource = resourceFromAttributes({
  [ATTR_SERVICE_NAME]: process.env.OTEL_SERVICE_NAME ?? 'contact-api',
  [ATTR_SERVICE_NAMESPACE]: 'lean-dev-br',
  [ATTR_DEPLOYMENT_ENVIRONMENT_NAME]: 'production',
});

// No endpoint (local dev, tests) → skip provider registration entirely.
// trace.getTracer()/logs.getLogger() always return safe no-op implementations
// when nothing is registered, so callers never need to branch on this.
let tracerProvider: NodeTracerProvider | undefined;
let loggerProvider: LoggerProvider | undefined;

if (endpoint) {
  tracerProvider = new NodeTracerProvider({
    resource,
    spanProcessors: [
      new BatchSpanProcessor(new OTLPTraceExporter({ url: `${endpoint}/v1/traces`, headers })),
    ],
  });
  tracerProvider.register();

  loggerProvider = new LoggerProvider({
    resource,
    processors: [
      new BatchLogRecordProcessor({
        exporter: new OTLPLogExporter({ url: `${endpoint}/v1/logs`, headers }),
      }),
    ],
  });
  logs.setGlobalLoggerProvider(loggerProvider);
}

const tracer = trace.getTracer('contact-api');
const logger = logs.getLogger('contact-api');

/** Structured logging — replaces console.*, correlates with the active trace via emit-time context. */
export const log = {
  info: (message: string, attributes?: AnyValueMap) => {
    logger.emit({
      severityNumber: SeverityNumber.INFO,
      severityText: 'INFO',
      body: message,
      attributes,
    });
  },
  warn: (message: string, attributes?: AnyValueMap) => {
    logger.emit({
      severityNumber: SeverityNumber.WARN,
      severityText: 'WARN',
      body: message,
      attributes,
    });
  },
  error: (message: string, attributes?: AnyValueMap) => {
    logger.emit({
      severityNumber: SeverityNumber.ERROR,
      severityText: 'ERROR',
      body: message,
      attributes,
    });
  },
};

/** Wraps a child unit of work in its own span (e.g. the SES call, the reCAPTCHA fetch). */
export async function withSpan<T>(name: string, fn: () => Promise<T>): Promise<T> {
  const span = tracer.startSpan(name);
  try {
    const result = await context.with(trace.setSpan(context.active(), span), fn);
    span.setStatus({ code: SpanStatusCode.OK });
    return result;
  } catch (err) {
    span.recordException(err as Error);
    span.setStatus({ code: SpanStatusCode.ERROR, message: (err as Error).message });
    throw err;
  } finally {
    span.end();
  }
}

/**
 * Wraps the Lambda handler: extracts the incoming `traceparent` (continues
 * the frontend's trace, same-origin via CloudFront), creates the root span,
 * and force-flushes both processors before returning — Lambda frequently
 * freezes the process right after the response, so anything not flushed by
 * then is lost or arrives arbitrarily late on the next invocation.
 */
export function withTracing(
  handler: (event: APIGatewayProxyEventV2) => Promise<APIGatewayProxyResultV2>,
) {
  return async (event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> => {
    const parentContext = propagation.extract(context.active(), event.headers);
    const span = tracer.startSpan(
      `${event.requestContext.http.method} ${event.rawPath}`,
      { kind: SpanKind.SERVER },
      parentContext,
    );
    const spanContext = trace.setSpan(parentContext, span);

    try {
      const result = await context.with(spanContext, () => handler(event));
      if (typeof result !== 'string') {
        span.setAttribute('http.status_code', result.statusCode ?? 200);
      }
      span.setStatus({ code: SpanStatusCode.OK });
      return result;
    } catch (err) {
      span.recordException(err as Error);
      span.setStatus({ code: SpanStatusCode.ERROR, message: (err as Error).message });
      throw err;
    } finally {
      span.end();
      // A rejection here would override whatever the try block already
      // returned/threw (JS finally-block semantics) — a broken OTLP export
      // must never turn a successful response into a 500 for real visitors.
      try {
        await Promise.all([tracerProvider?.forceFlush(), loggerProvider?.forceFlush()]);
      } catch (flushErr) {
        console.warn('OTel flush failed (non-fatal):', flushErr);
      }
    }
  };
}

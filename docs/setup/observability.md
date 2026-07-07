# Observability Setup

Single pane: [Grafana Cloud](https://grafana.com/products/cloud/) (free tier). Frontend (Faro) and
backend (OTel) both ship telemetry there; CloudWatch and GCP Cloud Monitoring are wired in as
**datasources** so their native metrics are queryable from the same place, not migrated.

- **Frontend** — Grafana Faro Web SDK: JS errors (unminified via public sourcemaps), Web Vitals,
  and browser traces. Homepage, blog, and todo all report to it.
- **Backend** — OpenTelemetry: relay-service (traces + metrics, Java/GraalVM native) and
  contact-api (traces, manual spans in a bundled Lambda) export OTLP directly to Grafana.
- **Datasources** — CloudWatch (read-only IAM user) and GCP Cloud Monitoring (read-only service
  account), provisioned as code via `infra/grafana`.

All identifiers below are externalized via Pulumi config or GitHub Actions vars — nothing is
hard-coded in application code.

## 1. Grafana Cloud account + Frontend Observability app

1. Create a free Grafana Cloud account and stack.
2. Under **Frontend Observability**, create one app (used by homepage, blog, _and_ todo — see the
   app-name note below). Note its **app key** and **collector URL**, e.g.:
   ```
   https://faro-collector-prod-sa-east-1.grafana.net/collect/<app-key>
   ```
3. The app key is **not secret** — it ships to every browser regardless — so it's plain Pulumi
   config, not a secret.

**Why one shared app, not three:** Grafana stamps the registered app's name onto
`service.name`/`gf.feoIly.app.name` for everything sent through its collector path, collapsing any
per-SDK value. Splitting into three separate Frontend Observability apps was considered and
deferred; instead `libs/faro` adds a custom `app.name` resource attribute (`homepage`/`blog`/`todo`)
that Grafana doesn't touch, since it's not one of its recognized fields — filter/group on
`app.name`, not `service.name`, to distinguish the three apps.

## 2. Same-origin telemetry proxy (`/o11y/*`)

Faro's default collector endpoint is a third-party hostname, which ad blockers (uBlock, Brave,
Safari ITP) block on sight. Browsers beacon to our own domain instead; CloudFront reverse-proxies
to Grafana server-side, where no blocker can intervene.

```sh
cd infra/homepage
pnpm exec pulumi config set faroCollectorHost faro-collector-prod-sa-east-1.grafana.net --stack prod
pnpm exec pulumi config set faroCollectorPath /collect/<app-key> --stack prod
pnpm exec pulumi up --stack prod
```

This provisions a CloudFront custom origin (`faro`) plus an `/o11y/*` cache behavior
(`CACHING_DISABLED`, `ALL_VIEWER_EXCEPT_HOST` origin-request policy so Host gets rewritten to
Grafana's). The CloudFront Function ([cloudfront-edge.js](../../infra/homepage/cloudfront-edge.js))
rewrites `/o11y/collect` → `faroCollectorPath` at request time; the path itself is baked into the
function source at deploy time via a `%%FARO_COLLECTOR_PATH%%` placeholder substitution
([hosting.ts](../../infra/homepage/hosting.ts)).

Verify:

```sh
curl -i -X POST https://lean.dev.br/o11y/collect -d '{}'
```

Expect a response from Grafana's collector (not a CloudFront error), and no CSP change required —
`connect-src 'self'` already covers it.

## 3. Frontend Faro init (homepage, blog, todo)

All three apps call the shared [`libs/faro`](../../libs/faro/index.js)'s
`initObservability(flags, meta)`, pointing at the same-origin `/o11y/collect` path.

**Flag-gated** — init is skipped unless the `observability-faro` flag (in
[`apps/homepage/public/flags.json`](../../apps/homepage/public/flags.json), fetched by all three
apps at the domain-root `/flags.json`) evaluates true. This is the only part of the rollout with a
kill-switch: it's the one piece of code running in a visitor's browser, touching CSP/Trusted Types,
where a bad init could break page render. Flip it locally without a redeploy:

```sh
# edit apps/homepage/public/flags.json, then:
aws s3 cp apps/homepage/public/flags.json s3://<homepage-bucket>/flags.json
aws cloudfront create-invalidation --distribution-id <dist-id> --paths /flags.json
```

**Sampling** — both currently set to no-sampling (`NON_ERROR_SAMPLE_RATE = 1`,
`sessionTracking.samplingRate = 1` in `libs/faro/index.js`). Errors are always kept regardless of
rate. Byte-volume math showed even 100% frontend capture stays far under the 50GB/month free-tier
ceiling at this traffic — lowering the rate wouldn't buy real savings, just lose trace/session
correlation. If traffic ever grows enough to matter, `hashToUnitInterval` already makes the sampling
decision trace/session-consistent (every span/log of one trace agrees), so it's safe to lower later
without re-introducing the "half a trace missing" problem a naive per-item `Math.random()` causes.

**Cross-origin trace correlation (todo → relay-service)** — Faro only propagates `traceparent`
same-origin by default. Todo's `initObservability` call passes
`propagateTraceHeaderCorsUrls: [relayServiceUrl]` explicitly. Confirmed live: a todo sync request
shows up in Tempo as one trace with `Services: 2` (`todo` + `relay-service`).

## 4. Public sourcemaps

`apps/homepage/vite.config.ts`, `apps/todo/vite.config.ts` → `build.sourcemap: true`;
`apps/blog/next.config.js` → `productionBrowserSourceMaps: true`. No extra upload step: Grafana's
Faro receiver auto-fetches the `.map` via the bundle's own `sourceMappingURL` comment — the newer
"private sourcemap upload" feature exists for teams that _don't_ want to publish source, which
doesn't apply here (source is already public on GitHub). CI tags every Faro event with the short
git SHA (`VITE_APP_VERSION` / `NEXT_PUBLIC_APP_VERSION`) for release grouping.

## 5. Backend OTel — contact-api (Lambda)

Manual spans ([`apps/contact-api/src/otel.ts`](../../apps/contact-api/src/otel.ts)), not
auto-instrumentation — see the bundled-Lambda footgun note below.

```sh
cd infra/homepage
pnpm exec pulumi config set otelExporterOtlpEndpoint https://otlp-gateway-prod-sa-east-1.grafana.net/otlp --stack prod
pnpm exec pulumi config set --secret otelExporterOtlpHeaders 'Authorization=Basic <base64 instanceId:token>' --stack prod
pnpm exec pulumi up --stack prod
```

`OTEL_EXPORTER_OTLP_HEADERS` follows the W3C Baggage format (`Key=Value,Key2=Value2`,
percent-encoded) — `otel.ts`'s `parseOtlpHeaders` percent-decodes it, so the literal space in
`Basic <token>` survives as `%20` in config and a real space on the wire. If Grafana ever returns
401 "no credentials provided" here, check that decoding step first.

**Why manual spans, not the ADOT Lambda layer:** contact-api is esbuild-bundled
(`thirdParty: true`) — but that's not actually why auto-instrumentation was skipped; our two real
network calls (`@aws-sdk/client-ses`, external; `fetch()`, monkeypatched not require-hooked) sit
outside the bundling boundary either way. The real reason: the AWS ADOT layer ships its own
embedded OTel Collector defaulting to X-Ray — redirecting it to Grafana needs a bundled
collector-config file plus a Layer ARN to track, a bigger moving part than ~15 lines of
`tracer.startSpan()`/`context.with()` for a function this small.

## 6. Backend OTel — relay-service (Spring Boot, GraalVM native)

```sh
cd infra/relay-service
pnpm exec pulumi config set otelOtlpEndpoint https://otlp-gateway-prod-sa-east-1.grafana.net/otlp/v1/traces --stack prod
pnpm exec pulumi config set --secret otelOtlpAuthorization 'Basic <base64 instanceId:token>' --stack prod
pnpm exec pulumi up --stack prod
```

Metrics reuse the same gateway and auth token — `infra/relay-service/index.ts` derives the metrics
URL from `otelOtlpEndpoint` (swaps `/v1/traces` → `/v1/metrics`) rather than needing a second config
entry to keep in sync. Sampling is no-sampling here too
(`management.tracing.sampling.probability: 1.0` in `application-prod.yaml`), same reasoning as
Faro's.

**GraalVM native + Spring AOT footgun — read this before touching any `@ConditionalOnProperty` or
`@ConditionalOnBean` in this app.** Spring's AOT engine evaluates those conditions at native-image
**build** time and bakes the result in permanently — not at runtime. relay-service's real OTLP
trace exporter was silently excluded from _every_ native image shipped for the first several weeks
of this rollout, because its auto-configured bean was gated on the endpoint property, which is only
ever known via a Cloud Run runtime env var, never present during the CI build. If you need a bean
whose presence depends on a runtime-only value, register it **unconditionally** and do the
presence/enablement check as a plain `if` inside the bean method body instead — see
[`DirectOtlpTracingConfig.java`](../../apps/relay-service/src/main/java/br/dev/lean/relay/DirectOtlpTracingConfig.java)
for the pattern, and its Javadoc for the full story. Ground truth for what actually made it into a
native image: `target/spring-aot/main/sources/**/*__BeanDefinitions.java` — if there's no
`getXxxBeanDefinition()` method for your bean there, it isn't in the binary, no matter what the
annotation says.

**Re-diagnosing OTLP export issues** (no redeploy needed):

```sh
# bump exporter logging
gcloud run services update relay-service --region=us-central1 \
  --update-env-vars LOGGING_LEVEL_IO_OPENTELEMETRY_EXPORTER=DEBUG,LOGGING_LEVEL_IO_OPENTELEMETRY_SDK_TRACE_EXPORT=DEBUG

# flip on the independent diagnostic SpanProcessor (logs every span lifecycle event + startup config dump)
gcloud run services update relay-service --region=us-central1 \
  --update-env-vars RELAY_DIAGNOSTICS_OTELENABLED=true
```

Both default off/`WARN` in `application-prod.yaml` — deliberately gated via a runtime
`Environment` check in `OtelDiagnostics.java`, not `@ConditionalOnProperty`, for the same
AOT-timing reason above.

**Known limitation — intermittent metrics-publish failures are expected.** Cloud Run's
`cpuIdle: true` throttles CPU for background threads between requests. The trace pipeline is
immune (`TraceFlushFilter` force-flushes synchronously inside request handling), but the metrics
exporter's 1-minute publish tick runs on its own schedule, independent of request timing — ticks
that land while the instance is fully idle can fail with `HttpConnectTimeoutException`. Enough
land near real traffic that data still reaches Grafana; the full fix (`cpuIdle: false`, always-billed
CPU) isn't worth the cost tradeoff for a secondary signal on a low-traffic site.

## 7. Grafana Cloud datasources (CloudWatch + GCP Cloud Monitoring)

`infra/grafana` provisions both as read-only datasources so native AWS/GCP metrics are queryable
from Grafana directly, rather than a third console.

1. In Grafana Cloud, create a service account with the **Admin** org role (datasource CRUD is
   Admin-only in Grafana's RBAC — Editor isn't enough) and generate an API token.
2. Configure and deploy:
   ```sh
   cd infra/grafana
   pnpm exec pulumi config set gcp:project lean-dev-br --stack prod
   pnpm exec pulumi config set aws:region us-east-1 --stack prod
   pnpm exec pulumi config set grafanaUrl https://<your-stack>.grafana.net --stack prod
   pnpm exec pulumi config set --secret grafanaAuth <service-account-token> --stack prod
   pnpm exec pulumi up --stack prod
   ```

This creates an AWS IAM user (`CloudWatchReadOnlyAccess` managed policy + access key) feeding a
`cloudwatch`-type datasource, and a GCP service account (`roles/monitoring.viewer` + JSON key)
feeding a `stackdriver`-type datasource (Grafana's internal id for GCP Cloud Monitoring). Uses the
real `@pulumiverse/grafana` provider — `@pulumi/grafana` doesn't exist.

**Deferred:** an OCI Monitoring datasource, until the k8s/OCI showcase app exists.

## 8. CI wiring

| Name                                           | Kind                                   | Used for                            |
| ---------------------------------------------- | -------------------------------------- | ----------------------------------- |
| `VITE_APP_VERSION` / `NEXT_PUBLIC_APP_VERSION` | derived from `$GITHUB_SHA` in-workflow | Faro/error release tagging          |
| `PULUMI_ACCESS_TOKEN`                          | GH secret                              | all three `pulumi up` deploy jobs   |
| `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY`  | GH secrets                             | frontend + grafana deploy jobs      |
| `GCP_CREDENTIALS`                              | GH secret                              | relay-service + grafana deploy jobs |

Faro's app-key/collector, both OTLP endpoint/auth pairs, and the Grafana provider's `url`/`auth`
live **only** as Pulumi stack config (`Pulumi.prod.yaml`, secrets encrypted via Pulumi Cloud) — not
as GitHub repo secrets/variables.

## CSP / Trusted Types violation reporting

Independent of Faro/RUM: a `ReportingObserver` beacons CSP and Trusted Types violations to
`POST /api/csp-report`, which the contact-api Lambda logs to CloudWatch Logs.

```sh
cd infra/homepage
pulumi config set cspReportRateLimit 10   # API Gateway steady-state req/s
pulumi config set cspReportBurstLimit 20  # API Gateway burst ceiling
pulumi config set cspReportMaxBytes 2048  # max report body length logged (cost guard)
```

`Content-Security-Policy-Report-Only` ships first; promote `require-trusted-types-for 'script'`
into the enforced CSP only after CloudWatch Logs show zero violations from reCAPTCHA / the Faro SDK.

## Notes / known gaps

- **CloudWatch RUM is retired.** It predated this rollout and has been fully removed (SDK, infra
  AppMonitor + Cognito identity pool, CSP allowlist entries). Faro subsumes it — don't reintroduce
  both.
- **Tail sampling** (buffer whole traces at a collector, keep only errors/slow ones) was considered
  and deferred — this architecture exports straight from SDK to Grafana with no collector in the
  path. Worth revisiting for the future k8s microservices demo, where multiple real backend
  services make tail sampling's value real.
- `VITE_FLAGS_URL` is declared in CI and app env types but not actually read anywhere at runtime —
  every app's flag fetch is hardcoded to `/flags.json`. Harmless dead wiring; clean up if touching
  that code anyway.

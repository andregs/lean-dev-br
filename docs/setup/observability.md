# Observability Setup

Client-side observability has two parts:

- **CloudWatch RUM** — JS errors + performance, via the `aws-rum-web` SDK.
- **CSP / Trusted Types violation reporting** — a `ReportingObserver` beacons violations to `POST /api/csp-report`, which the contact-api Lambda logs to CloudWatch Logs.

All values are externalized: server-side limits live in Pulumi config, client-side identifiers live in GitHub Actions repository variables. No defaults are hard-coded in application code.

## 1. Server-side config (Pulumi)

Set in `infra/homepage/Pulumi.<stack>.yaml` (committed) or via CLI. These are **required** — the stack fails to preview if absent.

| Config key | Meaning | Suggested value |
|---|---|---|
| `cspReportRateLimit` | API Gateway steady-state req/s on `/api/csp-report` | `10` |
| `cspReportBurstLimit` | API Gateway burst ceiling on `/api/csp-report` | `20` |
| `cspReportMaxBytes` | Max report body length the Lambda logs (cost guard) | `2048` |

```zsh
cd infra/homepage
pulumi config set cspReportRateLimit 10
pulumi config set cspReportBurstLimit 20
pulumi config set cspReportMaxBytes 2048
```

## 2. Deploy, then read the RUM outputs

The RUM identifiers don't exist until the infra is created. After the first `pulumi up`:

```zsh
cd infra/homepage
pulumi stack output appMonitorId
pulumi stack output identityPoolId
pulumi stack output guestRoleArn
```

## 3. Client-side config (GitHub Actions variables)

The frontend embeds these at build time. Add under **Settings → Secrets and variables → Actions → Variables**. They are public identifiers, so variables (not secrets) are correct.

| Variable name | Source |
|---|---|
| `VITE_RUM_APP_MONITOR_ID` | `pulumi stack output appMonitorId` |
| `VITE_RUM_IDENTITY_POOL_ID` | `pulumi stack output identityPoolId` |
| `VITE_RUM_GUEST_ROLE_ARN` | `pulumi stack output guestRoleArn` |
| `VITE_RUM_SESSION_SAMPLE_RATE` | Sampling fraction `0.0`–`1.0` (start at `0.1`) |

If any RUM variable is missing the SDK logs a warning and skips init — the site keeps working. The CSP-report endpoint is independent and needs no client config.

## 4. Local development

RUM stays disabled locally unless you set the four `VITE_RUM_*` values in `apps/homepage/.env.local` (git-ignored). Leaving them unset is the normal local state.

## Notes

- **Sampling** caps RUM event volume to stay inside the free tier; `0.1` = 10% of sessions.
- **Trusted Types** ships in `Content-Security-Policy-Report-Only` first. Promote `require-trusted-types-for 'script'` into the enforced CSP only after CloudWatch Logs show zero violations from reCAPTCHA / the RUM SDK.
- The reporting endpoint is deliberately throttled per-route and length-capped so a tight loop of violations can't drain the CloudWatch free tier.

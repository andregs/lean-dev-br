# contact-api

AWS Lambda handler for the `lean.dev.br` contact form. Receives `POST /api/contact` from the frontend, verifies reCAPTCHA v3, and sends email via SES.

## Request flow

```
CloudFront /api/* → API Gateway HTTP API → Lambda → reCAPTCHA siteverify
                                                   → SES: notify André (required)
                                                   → SES: ACK visitor (best-effort, only if email provided)
```

André's address is never included in the ACK email sent to visitors.

## Environment variables

| Variable | Required | Description |
|---|---|---|
| `RECAPTCHA_SECRET` | Yes | reCAPTCHA v3 secret key (from Pulumi secret) |
| `RECAPTCHA_VERIFY_URL` | Yes | `https://www.google.com/recaptcha/api/siteverify` |
| `RECAPTCHA_ACTION` | Yes | `contact` — submissions with a different action are rejected |
| `NOTIFY_EMAIL` | Yes | Address that receives contact form submissions (from Pulumi secret) |
| `FROM_EMAIL` | Yes | `do-not-reply@lean.dev.br` |
| `SUBJECT_PREFIX` | Yes | `[Contact]` |
| `MIN_SCORE` | Yes | Minimum reCAPTCHA score to accept (default `0.5`) |

All variables are set by Pulumi at deploy time. See [docs/setup/recaptcha.md](../../docs/setup/recaptcha.md) and [docs/setup/ses.md](../../docs/setup/ses.md).

## Development

```zsh
# Unit tests (mocks reCAPTCHA and SES)
pnpm nx test contact-api

# Integration tests (requires Docker — starts LocalStack)
pnpm nx run contact-api:test:integration

# Build (produces dist/handler.js for Lambda)
pnpm nx build contact-api
```

## Deployment

Deployed as part of the `infra/homepage` Pulumi stack — not standalone. See [docs/setup/pulumi.md](../../docs/setup/pulumi.md).

```zsh
pnpm nx build contact-api   # required before pulumi up
cd infra/homepage
pulumi up
```

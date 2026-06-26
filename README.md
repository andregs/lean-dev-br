# lean.dev.br

Full-stack portfolio — a NX monorepo containing frontend & backend code, serverless, JVM-native microservice, multi-cloud IaC, security hardening, observability, and end-to-end testing. For now.

**Live site:** [lean.dev.br](https://lean.dev.br)

## Highlights

- **WebAuthn passkeys + offline CRDT sync** — todo app uses PRF-extension passkeys for auth and Yjs for conflict-free offline editing synced over a relay
- **GraalVM native-image service on Cloud Run** — Spring Boot 4 relay service compiles to a native binary, deployed to GCP Cloud Run
- **Multi-cloud IaC with Pulumi** — AWS stack (S3, CloudFront, Route53, API Gateway, SES) and GCP stack (Artifact Registry, Cloud Run, Firestore) managed as TypeScript programs
- **Security hardening** — strict Content-Security-Policy, Trusted Types policies, reCAPTCHA v3 on contact form, `application/problem+json` error responses (RFC 7807)
- **Feature flags + i18n** — OpenFeature-backed flags (web + server) and i18next with en / pt-BR path-prefix routing, shared as workspace libraries
- **Real-user monitoring** — CloudWatch RUM via a shared `rum` library
- **Affected-based CI** — Nx Cloud-aware pipelines run only what changed; OSV vulnerability scanning and synthetic monitoring run on a schedule

## Tech Stack

| Layer           | Technologies                                                                        |
| --------------- | ----------------------------------------------------------------------------------- |
| **Frontend**    | Vanilla HTML/CSS/TS (homepage, todo), Next.js 16 / React 19 + MDX (blog)            |
| **Backend**     | AWS Lambda / Node.js (contact-api), Spring Boot 4 / Java 25 GraalVM (relay-service) |
| **Infra (AWS)** | S3, CloudFront, Route53, API Gateway, SES, Lambda@Edge — Pulumi/TS                  |
| **Infra (GCP)** | Artifact Registry, Cloud Run, Firestore — Pulumi/TS                                 |
| **Monorepo**    | Nx 23, pnpm 11, asdf                                                                |
| **Testing**     | Vitest (unit), Playwright (e2e)                                                     |
| **CI/CD**       | GitHub Actions (lint, test, build, deploy, OSV scan, synthetic monitor)             |

## Project Layout

```
apps/
  homepage/         — portfolio landing page (vanilla HTML/CSS/TS + Vite)
  blog/             — dev blog (Next.js, MDX via Velite)
  todo/             — offline-first todo PWA (WebAuthn passkeys, Yjs CRDT)
  contact-api/      — contact-form Lambda handler (reCAPTCHA v3 + SES)
  relay-service/    — Yjs sync relay (Spring Boot / GraalVM, GCP Cloud Run)
  *-e2e/            — Playwright suites for homepage, blog, and todo

libs/
  design-system/    — shared design tokens, CSS, and components
  csp/              — Content-Security-Policy builder helpers
  trusted-types/    — Trusted Types policies
  flags/            — OpenFeature wrapper (web + server)
  i18n/             — i18next setup with en/pt-BR + parity check
  rum/              — CloudWatch RUM initialisation
  e2e-support/      — shared Playwright utilities

infra/
  homepage/         — AWS resources (S3, CloudFront, Route53, API GW, SES)
  relay-service/    — GCP resources (Cloud Run, Artifact Registry, Firestore)

docs/setup/         — step-by-step setup guides (AWS, GCP, Pulumi, DNS, …)
```

## Getting Started

```zsh
asdf install          # install pinned tool versions (.tool-versions)
pnpm install          # install Node dependencies

pnpm nx run-many -t build           # build all projects
pnpm nx affected -t test            # test only what changed
```

Cloud and service credentials are required for most apps. See the guides in [docs/setup/](docs/setup/):
[AWS](docs/setup/aws.md) · [GCP](docs/setup/gcp.md) · [Pulumi](docs/setup/pulumi.md) · [reCAPTCHA](docs/setup/recaptcha.md) · [SES](docs/setup/ses.md) · [DNS](docs/setup/dns.md) · [Observability](docs/setup/observability.md) · [Feature Flags](docs/setup/feature-flags.md) · [E2E](docs/setup/e2e.md)

## Deploying

Push to `main` triggers the GitHub Actions deploy workflow — builds affected projects and applies Pulumi stacks. See [docs/setup/](docs/setup/) for manual deploy instructions per stack.

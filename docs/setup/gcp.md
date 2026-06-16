# GCP Setup

This guide covers one-time GCP setup for deploying `relay-service` (GraalVM native image) to Cloud Run via the `infra/relay-service` Pulumi stack.

## Prerequisites

- [gcloud CLI](https://cloud.google.com/sdk/docs/install) installed and authenticated (`gcloud auth login`)
- [Docker](https://docs.docker.com/get-docker/) installed (for building/pushing images)
- Pulumi CLI installed (`pnpm exec pulumi` works once `pnpm install` is run)
- A GCP billing account (Cloud Run has a free tier; `max-instances=1` keeps costs near zero)

## 1. Create a GCP project

```sh
gcloud projects create lean-dev-br --name="lean.dev.br"
gcloud config set project lean-dev-br
gcloud billing projects link lean-dev-br --billing-account=<BILLING_ACCOUNT_ID>
```

Find your billing account ID: `gcloud billing accounts list`

## 2. Enable required APIs

```sh
gcloud services enable \
  run.googleapis.com \
  artifactregistry.googleapis.com \
  iam.googleapis.com \
  firestore.googleapis.com \
  cloudscheduler.googleapis.com
```

## 3. Create a service account for Pulumi

```sh
gcloud iam service-accounts create pulumi-deployer \
  --display-name="Pulumi Deployer"

gcloud projects add-iam-policy-binding lean-dev-br \
  --member="serviceAccount:pulumi-deployer@lean-dev-br.iam.gserviceaccount.com" \
  --role="roles/run.admin"

gcloud projects add-iam-policy-binding lean-dev-br \
  --member="serviceAccount:pulumi-deployer@lean-dev-br.iam.gserviceaccount.com" \
  --role="roles/artifactregistry.admin"

gcloud projects add-iam-policy-binding lean-dev-br \
  --member="serviceAccount:pulumi-deployer@lean-dev-br.iam.gserviceaccount.com" \
  --role="roles/iam.serviceAccountUser"

gcloud projects add-iam-policy-binding lean-dev-br \
  --member="serviceAccount:pulumi-deployer@lean-dev-br.iam.gserviceaccount.com" \
  --role="roles/datastore.owner"

gcloud projects add-iam-policy-binding lean-dev-br \
  --member="serviceAccount:pulumi-deployer@lean-dev-br.iam.gserviceaccount.com" \
  --role="roles/cloudscheduler.admin"

gcloud projects add-iam-policy-binding lean-dev-br \
  --member="serviceAccount:pulumi-deployer@lean-dev-br.iam.gserviceaccount.com" \
  --role="roles/iam.serviceAccountAdmin"

gcloud projects add-iam-policy-binding lean-dev-br \
  --member="serviceAccount:pulumi-deployer@lean-dev-br.iam.gserviceaccount.com" \
  --role="roles/monitoring.editor"
```

- `roles/datastore.owner` — create the Firestore database.
- `roles/cloudscheduler.admin` — create the daily prune job.
- `roles/iam.serviceAccountAdmin` — create the `relay-runtime` Cloud Run service account.
- `roles/monitoring.editor` — create the quota alert policy + notification channel.

## 4. Authenticate Pulumi with GCP

**Option A — Application Default Credentials (local dev):**

```sh
gcloud auth application-default login
```

Pulumi GCP provider picks up ADC automatically. No key file needed locally.

**Option B — Service account key (CI/CD):**

```sh
gcloud iam service-accounts keys create pulumi-gcp-key.json \
  --iam-account=pulumi-deployer@lean-dev-br.iam.gserviceaccount.com
export GOOGLE_CREDENTIALS=$(cat pulumi-gcp-key.json)
```

Store `GOOGLE_CREDENTIALS` as a GitHub Actions secret (`GCP_CREDENTIALS`). Never commit the key file.

## 5. Configure and deploy the Pulumi stack

```sh
cd infra/relay-service
pnpm install
pnpm exec pulumi stack init prod
pnpm exec pulumi config set gcp:project lean-dev-br --stack prod
pnpm exec pulumi config set gcp:region us-central1 --stack prod
pnpm exec pulumi config set --secret pruneToken "$(openssl rand -hex 32)" --stack prod
pnpm exec pulumi config set --secret alertEmail you@example.com --stack prod
pnpm exec pulumi up --stack prod
```

This creates:
- Artifact Registry repository `relay-service` in `us-central1`
- Firestore database `(default)` (Native mode, `us-central1`) — **location is permanent**; pick the same region as Cloud Run and never change it
- Runtime service account `relay-runtime` with `roles/datastore.user`, attached to the Cloud Run service
- Cloud Run service `relay-service` with placeholder image (returns 200 Hello World until real image is deployed), `SPRING_PROFILES_ACTIVE=prod` and `PRUNE_TOKEN` envs
- Cloud Scheduler job calling `/internal/prune` daily with the `X-Prune-Token` header
- A monitoring notification channel (email) + alert policies on Firestore daily read/write quota (80% of the free tier)

`pruneToken` and `alertEmail` are set with `--secret` because `Pulumi.<stack>.yaml` is committed to this (public) repo — plaintext config there would leak the email to scrapers and hand out the prune endpoint's bearer token.

Note the `repoUrl` output — you'll use it to tag and push images.

## 6. Build and push the Docker image

```sh
# Authenticate Docker with Artifact Registry
gcloud auth configure-docker us-central1-docker.pkg.dev

# Build and push (from repo root)
RELAY_IMAGE=us-central1-docker.pkg.dev/lean-dev-br/relay-service/relay-service:v1 \
  pnpm nx run relay-service:docker-build

RELAY_IMAGE=us-central1-docker.pkg.dev/lean-dev-br/relay-service/relay-service:v1 \
  pnpm nx run relay-service:docker-push
```

The `docker-build` target uses Spring Boot Cloud Native Buildpacks to compile a GraalVM native image. First run is slow (~10–20 minutes); subsequent builds reuse the Paketo builder layer cache.

## 7. Deploy with the real image

```sh
cd infra/relay-service
pnpm exec pulumi config set imageTag v1 --stack prod
pnpm exec pulumi up --stack prod
```

## 8. Wire the relay-service URL to the homepage stack

Copy `serviceUrl` from the Pulumi output, then:

```sh
cd infra/homepage
pnpm exec pulumi config set relayServiceUrl <serviceUrl> --stack prod
pnpm exec pulumi up --stack prod
```

This bakes the Cloud Run URL into the todo app's Content-Security-Policy (`connect-src`), allowing the browser to reach the relay.

## Cost notes

- Cloud Run: `min-instances=0` → scales to zero between syncs; `cpuIdle: true` means request-based billing. Free tier (monthly, resets monthly): 2M requests, 180k vCPU-seconds, 360k GiB-seconds — this app stays well within it under normal personal use.
  - Current pricing/free tier: https://cloud.google.com/run/pricing
- Artifact Registry: first 0.5 GB/month free, $0.10/GB-month after; a native image is ~50–80 MB.
  - Current pricing/free tier: https://cloud.google.com/artifact-registry/pricing
- Firestore: free tier resets daily (50k reads, 20k writes, 20k deletes, 1 GiB storage) — the Pulumi-managed alert policies email at 80% usage.
  - Current free-tier limits: https://cloud.google.com/firestore/pricing
  - Live usage dashboard: https://console.cloud.google.com/firestore/databases/-default-/usage?project=lean-dev-br
  - If limits change or usage patterns shift, adjust `thresholdValue` in the `AlertPolicy` resources in `infra/relay-service/index.ts`.
- Cloud Scheduler: first 3 jobs/month free per billing account, $0.10/job-month after; this stack uses 1.
  - Current pricing/free tier: https://cloud.google.com/scheduler/pricing
- Total expected cost: **$0/month**.

### Manual: Billing budget alert

GCP has no native hard spend cap, so set a budget alert as a safety net:

1. Console → Billing → Budgets & alerts → Create budget
2. Scope: this project, amount ~$1–$5/month
3. Alert thresholds: 50%, 90%, 100% of budget, email to project owners

This is manual (not in Pulumi) to avoid granting `roles/billing.admin` to the deployer service account.

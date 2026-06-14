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
  iam.googleapis.com
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
```

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
pnpm exec pulumi up --stack prod
```

This creates:
- Artifact Registry repository `relay-service` in `us-central1`
- Cloud Run service `relay-service` with placeholder image (returns 200 Hello World until real image is deployed)

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

- Cloud Run: `min-instances=0` → scales to zero between syncs. Free tier covers 2M requests/month and 360k vCPU-seconds. This app stays within free tier under normal personal use.
- Artifact Registry: first 0.5 GB/month free; a native image is ~50–80 MB.
- Total expected cost: **$0/month**.

# Wanderlust Local Dev Setup

Wanderlust is a Kubernetes fullstack showcase: Angular UI, Spring native microservices, k3s.
This covers running the pieces that exist so far (skeleton iteration — Angular shell on mocks,
bootable service skeletons, bare local cluster; no wiring between them yet).

## Prerequisites

[Local tooling](local-tooling.md) (asdf, pnpm) plus Java (already pinned in `.tool-versions`) and
Docker (k3d creates cluster nodes as Docker containers).

## Angular shell (`wanderlust-web`)

No backend yet — the shell runs entirely against MSW-mocked responses.

```zsh
pnpm nx serve wanderlust-web
```

Open http://localhost:4206. The destinations list on the home route is served by
`apps/wanderlust-web/src/mocks/handlers.ts`, not a real API.

Regenerate the OpenAPI-derived types after editing the contract:

```zsh
pnpm nx run wanderlust-contracts:openapi-types
```

## Spring native services

Each service (`wanderlust-bff`, `wanderlust-catalog`, `wanderlust-booking`,
`wanderlust-reservation`, `wanderlust-payment`) is a bootable skeleton — no business endpoints yet,
just `/actuator/health`.

```zsh
pnpm nx serve wanderlust-bff
curl http://localhost:8080/actuator/health
```

Each service defaults to port 8080 — only run one at a time locally, or override per service:
`./mvnw spring-boot:run -Dspring-boot.run.arguments=--server.port=8081` from the service's directory.

## k3d cluster

Bare cluster only — no in-cluster resources yet (those land via `infra/wanderlust`'s Pulumi stack
starting iteration 7). k8s resources always go through `@pulumi/kubernetes` here, never
`helm install` or raw manifests — see [Pulumi Cloud login](pulumi.md) if you need to run
`pulumi preview`/`up` against this stack.

```zsh
k3d cluster create --config infra/wanderlust/k3d/cluster.yaml
kubectl get nodes   # k3d-wanderlust-server-0   Ready   control-plane

# when done
k3d cluster delete wanderlust
```

# Dependency Management

Automated dependency updates and CVE scanning across all five surfaces: npm (pnpm workspace),
Maven (`relay-service`), GitHub Actions, asdf dev tools, and the Paketo buildpack container.

---

## Architecture: two separate channels

| Channel                                                    | Purpose                                           | Cadence                                                |
| ---------------------------------------------------------- | ------------------------------------------------- | ------------------------------------------------------ |
| **Dependabot alerts** + **Renovate `vulnerabilityAlerts`** | CVE/security fix PRs                              | Fires **immediately** when advisory DB updates (hours) |
| **Renovate routine PRs**                                   | Version bumps, lock file maintenance              | Weekly (Monday before 09:00 UTC)                       |
| **OSV-Scanner + Trivy** (CI)                               | Backstop scan — source manifests + deployed image | Daily 06:00 UTC                                        |

> Do not conflate routine update cadence with CVE response time. They are intentionally decoupled.

---

## Renovate

**Scope:** npm workspace · Maven · GitHub Actions · asdf `.tool-versions`

Config: [`renovate.json`](../../renovate.json)

### Auto-merge policy

| Surface           | Auto-merge                                         |
| ----------------- | -------------------------------------------------- |
| npm patch/minor   | ✅ after CI green + 3-day cooldown                 |
| GitHub Actions    | ✅ after CI green + 3-day cooldown (grouped)       |
| asdf dev tools    | ✅ after CI green + 3-day cooldown (grouped)       |
| npm major         | ❌ manual — labelled `needs-review`                |
| Spring Boot (any) | ❌ manual — labelled `needs-review`                |
| Security fix PRs  | ✅ immediate (cooldown bypassed, `prPriority: 10`) |

**Cooldown rationale:** the 3-day `minimumReleaseAge` window covers the period where a compromised
package is typically caught and yanked from the registry before Renovate would merge it. Security
fix PRs set `minimumReleaseAge: null` so they are not delayed.

**Dependency Dashboard:** Renovate opens a GitHub issue titled "Dependency Dashboard" that lists
pending/blocked/open PRs. Use it to manually trigger updates or unblock paused PRs.

### One-time setup (repo settings)

1. Install the **Renovate GitHub App** from [mend.io](https://www.mend.io/renovate/) on this repo.
2. Merge the onboarding PR Renovate creates (it validates the config and lists detected managers).
3. Confirm the Dependency Dashboard issue appears.
4. Enable **branch protection** on `main` requiring the `CI / verify` check — Renovate's
   `platformAutomerge` will not merge until CI passes.

> Alternative to the hosted App: self-host via a cron workflow using
> [`renovatebot/github-action`](https://github.com/renovatebot/github-action) with a PAT.
> The hosted App is simpler and has no infrastructure to maintain.

---

## Dependabot security alerts

Renovate handles version PRs. Dependabot is used **only** for security alerts (free, no PRs).

### One-time setup

Go to **Settings → Code security** in the GitHub repo and enable:

- **Dependency graph** (prerequisite)
- **Dependabot alerts**
- Leave "Dependabot security updates" **off** — Renovate `vulnerabilityAlerts` raises the fix PRs;
  enabling both creates duplicate PRs.

---

## OSV-Scanner — source manifest CVE scan

Workflow: [`.github/workflows/osv-scan.yml`](../.github/workflows/osv-scan.yml)

Scans `pnpm-lock.yaml` and `apps/relay-service/pom.xml` against the [OSV.dev](https://osv.dev)
advisory database. Findings upload as SARIF to the **Security → Code scanning** tab.

**PR behaviour:** runs on every PR to `main`; findings are report-only (`continue-on-error: true`).
To promote to blocking, remove `continue-on-error: true` from the `Run OSV-Scanner` step.

---

## Trivy — container image CVE scan

### Build-time scan (in `main.yml`)

Runs in `deploy-relay` **after** `docker-build`, **before** `docker-push`. Catches vulnerabilities
before the image reaches Artifact Registry. Currently report-only (`exit-code: '0'`).

To flip to blocking (recommended once baseline is clean):

```yaml
exit-code: '1'
```

### Daily deployed-image scan (in `osv-scan.yml`)

The `trivy-deployed-image` job runs on schedule and `workflow_dispatch`. It pulls the
`:latest` tag from Artifact Registry and re-scans with Trivy, surfacing CVEs disclosed after the
image was built. Requires `GCP_CREDENTIALS` secret (same as `deploy-relay`).

---

## Paketo builder image

The `relay-service` container base is pinned via a `<paketo.builder>` property in
[`apps/relay-service/pom.xml`](../../apps/relay-service/pom.xml):

```xml
<paketo.builder>paketobuildpacks/builder-jammy-tiny:0.0.502</paketo.builder>
```

Renovate's custom regex manager detects this and opens a PR when a new builder tag is published.
The version comment in `renovate.json` identifies it as a Docker datasource.

---

## GitHub Actions — SHA pinning

All `uses:` action references are pinned to full commit SHAs with a trailing version comment,
for example:

```yaml
uses: actions/checkout@df4cb1c069e1874edd31b4311f1884172cec0e10 # v6
```

This closes the moved-tag attack vector. Renovate's `github-actions` manager keeps the SHA
current and updates the trailing version comment automatically.

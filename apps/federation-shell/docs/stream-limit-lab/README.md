# HTTP/2 stream-limit stalling lab

Forces a real, provable HTTP/2 concurrent-stream stall on the federation demo itself, instead of
hoping a production site happens to be caught mid-stall. Serves the already-built
`apps/federation-{shell,catalog,cart}/dist` output from one local nginx origin — mirroring the
real single-CloudFront-distribution topology, so every request shares one HTTP/2 connection, which
is the whole point: the cap is per-connection. Compares a normal cap (128, nginx's own default)
against an artificially low one (2, well below the demo's own peak concurrency) with only that one
number changed, so the before/after delta is causal, not circumstantial.

Companion to `apps/federation-shell/docs/analyze-har.mjs` and the "Real-world corroboration"
section of `../comparison.md`, which found suggestive-but-not-dispositive evidence on a real
production site (peak concurrency there never crossed the ceiling). This lab closes that gap.

**Chrome's own client-side cap (`kMaxConcurrentStreamLimit = 256` in
`net/spdy/spdy_session.cc`) is a compile-time constant — no flag, Finch feature, or runtime switch
exists to change it.** So this lab can only vary the server side (nginx's
`http2_max_concurrent_streams`) — which is also the only side actually within a web team's control
in production anyway.

## Prerequisites

Docker + `docker compose`, `openssl`. No local `nginx` binary needed — everything runs in the
`nginx:1.31-alpine` container (check for a newer stable-alpine tag before you rely on this pin;
nginx ships new minors every couple of months).

## Running it

```sh
# 1. Fresh production builds
pnpm nx run-many -t build -p federation-shell,federation-catalog,federation-cart

# 2. One throwaway self-signed cert (gitignored, regenerate any time)
apps/federation-shell/docs/stream-limit-lab/gen-cert.sh

# 3. Baseline: nginx's own real default
cd apps/federation-shell/docs/stream-limit-lab
MAX_STREAMS=128 docker compose up -d
```

Open `https://localhost:8443/labs/federation/catalog` in **your own real Chrome** — not an
automated/CDP-driven one. This matters: Playwright's `context.recordHar()` produces a
structurally-valid HAR, but every entry's `timings.blocked` comes back `null` and there's no
`_connectionId` at all — it doesn't tap the browser's real net-internals queueing telemetry the way
DevTools' own exporter does. Confirmed by capturing one and inspecting it: 57 real requests, zero
usable timing data. A manual DevTools capture is not a fallback here, it's the only path that works.

Accept the self-signed cert warning (this is your own throwaway local nginx — safe to proceed).
Reload once so the full waterfall is in the buffer, then: **DevTools → Network tab → right-click →
"Save all as HAR with content"** → `baseline.har`.

```sh
# 4. Constrained: same build, same everything, one number changed
docker compose down
MAX_STREAMS=2 docker compose up -d
```

Reload `https://localhost:8443/labs/federation/catalog` again (hard-reload / disable cache so you
get the full request set, not a cached response), export the same way → `constrained.har`.

```sh
# 5. Compare
node apps/federation-shell/docs/analyze-har.mjs baseline.har    localhost
node apps/federation-shell/docs/analyze-har.mjs constrained.har localhost
```

## What proves the point

- **Baseline (cap=128):** flat, low blocked times (single-digit ms) — same shape as the real tiny
  production HAR in `comparison.md`.
- **Constrained (cap=2):** requests past the 2-stream cap show blocked times spiking into the
  hundreds of ms; `remoteEntry.js`/`loadShare` rows climb the blocked-time ranking; average
  manifest-blocked time far exceeds the baseline.
- Lead with the **blocked-time delta**, not `analyze-har.mjs`'s peak-concurrency line — that metric
  counts wall-clock interval overlap (queued + actively-multiplexed together, since
  `startedDateTime` includes queue time), so it isn't itself proof; the blocked-time spike is.

Tear down when done: `docker compose down`.

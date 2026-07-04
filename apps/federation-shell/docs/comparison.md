# Modular monolith vs. microfrontends: `ui-modulith` vs. `federation`

Two implementations of the exact same demo — a catalog + cart e-commerce flow,
same React 19 + Vite 8 stack, same design system, same kernel contract
(`EventBus`, `cart/add`). The only thing that differs is how the three pieces
(shell, catalog, cart) are packaged, boundary-checked, and deployed:

|                            | `ui-modulith`                               | `federation`                                             |
| -------------------------- | ------------------------------------------- | -------------------------------------------------------- |
| Packaging                  | one Vite build, one bundle                  | three independent Vite builds (MF2)                      |
| Boundary enforcement       | `@nx/enforce-module-boundaries` (lint time) | `shared`/`singleton` config (runtime)                    |
| Cross-module contract      | in-process `EventBus`, plain import         | same `EventBus`, crossing a real network/remote boundary |
| Deploy                     | 1 S3 bucket, 1 pipeline stage               | 3 S3 buckets, all independently deployable               |
| Feature-boundary violation | `nx lint` fails the PR                      | nothing fails — it's just wrong at runtime               |

Both are live on the [Labs](https://lean.dev.br/labs) page:
[`/labs/ui-modulith/`](https://lean.dev.br/labs/ui-modulith/) and
[`/labs/federation/`](https://lean.dev.br/labs/federation/).

---

## The numbers

Measured on the same machine, cold Nx cache, same content (3 products, MSW-backed).

### Build

The interesting comparison isn't "1 build vs 3 builds" (of course three builds
take longer than one) — it's whether a **single, smaller** federation app is
even cheaper to build than the modulith's entire bundle. It isn't:

| build (cold, isolated)                                | wall time |
| ----------------------------------------------------- | --------- |
| `ui-modulith` — whole app, all features bundled       | 3.7s      |
| `federation-cart` — one remote, strictly less code    | 4.4s      |
| `federation-catalog` — one remote, strictly less code | 5.2s      |

Each individual remote has _less source code_ to compile than the modulith's
entire bundle (which contains both catalog and cart), yet takes **20–40%
longer**. That gap is MF2 tooling overhead — DTS generation, virtual-module
resolution, federation-runtime injection — that's paid **per app, as fixed
cost**, regardless of how little that app actually does. A modulith never
pays this cost at all; the cost also doesn't compound as new remotes are
added, so it may amortize better at large scale — this demo can only show
that the floor is already higher, not how the two curves diverge over time.

The flip side doesn't show up in any wall-clock number: in a real multi-team
org, these three builds run as independent CI jobs, genuinely in parallel, on
separate schedules, without waiting on each other. The monolith's fast build
is also its ceiling — it stays one build forever, however large the feature
set grows, and every team touching it shares that one build queue.

### Network — cold load of `/catalog`

Real request/byte counts from `performance.getEntriesByType('resource')`
against production-mode builds (enforced CSP, no dev-only relaxations):

|               | requests | bytes transferred |
| ------------- | -------- | ----------------- |
| `ui-modulith` | 8        | 263 KB            |
| `federation`  | 58       | 622 KB            |

**7x the requests, 2.4x the bytes** — for the _same rendered page_. The reason
is the headline finding of this whole build:

> `shared: { singleton: true }` guarantees a single **runtime module instance**.
> It does **not** guarantee a single **network fetch**.

Each of the three remotes (shell, catalog, cart) ships its own copy of every
shared dependency as a `loadShare` wrapper chunk. In this demo's network trace,
`react-router-dom` is fetched **three times** (~65 KB each, ~195 KB total for
one library), `i18next` three times (~15 KB × 3), `react-dom` three times. The
MF2 runtime does dedupe at the _module registry_ level once everything has
landed — whichever chunk registers into the shared scope first is the instance
actually used, and the other two copies' exports are simply discarded — but
all three still had to be downloaded, parsed, and evaluated first. The
"singleton" name describes the object identity guarantee, not the transfer
cost. A modulith has exactly one copy of everything, by construction, with
nothing to configure.

### Concurrent-stream limits — a risk this demo is too small to hit

MF2's whole model implicitly assumes that firing many small requests over one
connection is nearly free, because HTTP/2 (and HTTP/3) multiplex them over a
single connection. That's true up to a limit — and the limit is lower than
"many" people assume. **This is protocol-version-specific**, so it's worth
being precise about which protocol actually applies to us:

- [RFC 7540 §6.5.2](https://httpwg.org/specs/rfc7540.html#SettingValues)
  (`SETTINGS_MAX_CONCURRENT_STREAMS`, HTTP/2): recommends a floor of **100**,
  no ceiling defined; if a server never sends the setting, "initially, there
  is no limit."
- [nginx](https://nginx.org/en/docs/http/ngx_http_v2_module.html) defaults
  `http2_max_concurrent_streams` to **128**.
- Chrome hardcodes a **client-side** cap of **256** concurrent streams per
  HTTP/2 connection — and [enforces it regardless of what the server
  advertises](https://groups.google.com/a/chromium.org/g/chromium-discuss/c/I9eB4ajAXIw).
  A Chromium engineer's own explanation: it's a deliberate resource-protection
  limit, because "a misbehaving server could set the limit to a huge number
  and start that many requests which would each consume some non-trivial
  amount of memory." Firefox and Safari don't enforce this same cap.

So the _effective_ HTTP/2 limit talking to a stock nginx origin from Chrome is
`min(256, 128) = 128` concurrent streams on that connection — once exceeded,
the H2 stack stalls the excess requests instead of truly running them in
parallel.

**Does this even apply to us?** [CloudFront has supported HTTP/3 (QUIC) since
2022](https://aws.amazon.com/about-aws/whats-new/2022/08/amazon-cloudfront-supports-http-3-quic/),
but it's **opt-in per distribution**, not the default. Our own distribution
(`infra/homepage/hosting.ts`) never sets `httpVersion`, so it serves HTTP/2 —
the numbers above genuinely apply to this deployment today. If HTTP/3 were
enabled instead, the limit moves to QUIC's own `initial_max_streams_bidi`
transport parameter (negotiated per-connection, not a fixed SETTINGS value);
nginx's `http3_max_concurrent_streams` still defaults to 128 (parity with its
own HTTP/2 default) and H2O defaults to 100 for HTTP/3, but no public source
was found for Chrome's own QUIC stream-limit default specifically — that
would need direct measurement, not another search. AWS doesn't publish
CloudFront's concurrent-stream default for either protocol.

Our 58 requests are nowhere near any of these numbers — this demo can't
organically demonstrate an actual stall (though a controlled local lab further
below forces it anyway, by artificially lowering the cap). But the shape of the problem is visible in
miniature already: 3 shared deps × 3 remotes = 9 fetches for what should be 3
(6 of them redundant copies). This isn't hypothetical or unique to us:
[module-federation's own issue tracker documents shared modules being
duplicated across bundles in
practice](https://github.com/module-federation/module-federation-examples/issues/693),
and the [official `shared` config
docs](https://module-federation.io/configure/shared) warn against
`eager: true` specifically because it forces "all provided and fallback
modules" to download regardless of whether the shared version ultimately
matches. A real org with a dozen teams, each declaring the same
shared-dependency list, scales this multiplication directly — the
ecosystem's own guidance exists because this is a known, recurring cost, not
a corner case we happened to hit.

### Real-world corroboration — measured, not just theorized

Everything above is primary-source research plus our own too-small-to-stall demo. To check
whether this actually happens on a real production Module Federation site, we captured a HAR
(Chrome DevTools → Network tab → "Save all as HAR with content") from a live public product page
on [shop.lululemon.com](https://shop.lululemon.com) — a confirmed MF adopter (its
`/static/fmodules/dcp/*-remoteEntry.js` paths are unambiguous) found via
[module-federation.io's own showcase](https://module-federation.io/showcase). One PDP load, after
scrolling the full page and opening the image zoom, produced **507 total requests**, 197 of them
to `shop.lululemon.com` itself.

`apps/federation-shell/docs/analyze-har.mjs` is a small, dependency-free Node script that turns a
raw HAR into exactly the numbers below. It's written to run on **any** HAR, not just this one —
point it at your own capture from any site (or your own production MF app) to check whether
you're paying the same tax:

```sh
node apps/federation-shell/docs/analyze-har.mjs <path-to.har> [origin-substring]
```

If `origin-substring` is omitted, it picks the busiest origin in the capture automatically. Ran
against the Lululemon HAR:

```
Total requests in capture: 507
...
--- Focused on origin containing "shop.lululemon.com" (197 requests) ---

Protocol breakdown:
  1  http/2.0
  196  h3

Busiest connection (id 25363): 195 requests, peak concurrency 72 in-flight.
  -> Peak concurrency is below common stream-count ceilings — stalling below is more likely
     browser fetch-priority scheduling, not a hard multiplexing cap.

Federation-looking requests (remoteEntry/mf-manifest/*-mf-* naming), by blocked time:
     287ms blocked  cp/transformation-configs/latest/transformation-configs-remoteEntry.js
     286ms blocked  odules/dcp/validation-configs/latest/validation-configs-remoteEntry.js
     286ms blocked  /static/fmodules/dcp/lam-model/latest/lam-model-remoteEntry.js
     285ms blocked  fmodules/dcp/experiment-module/latest/experiment-module-remoteEntry.js
      10ms blocked  /11.14.0/static/chunks/__federation_expose_gdeRoot.5c5163855125c17e.js
       7ms blocked  /3.0.180/static/chunks/__federation_expose_pdp_app-1f315d27abcfb782.js
       6ms blocked  /static/uf/pdp-app/3.0.180/static/chunks/remoteEntry.js
       4ms blocked  /static/mwa-shared/layout/11.14.0/static/chunks/remoteEntry.js
       3ms blocked  /mwa-shared/digital-experience-app/2.0.10/static/chunks/remoteEntry.js
       2ms blocked  p/@lululemon/ab-testing-plugin/latest/ab-testing-plugin-remoteEntry.js
       2ms blocked  cp/@lululemon/metarouter-plugin/latest/metarouterplugin-remoteEntry.js
       2ms blocked  /2.0.10/static/chunks/__federation_expose_provider.ba76f84beae68018.js

Average blocked time: 42ms overall vs 98ms for federation-looking requests.
```

**Read honestly, not dramatically:** peak concurrency (72) never crossed the documented
stream-count ceilings from the section above — this is **not** proof of a hard multiplexing cap
being hit. It's also real production HTTP/3 (QUIC), confirming the "does HTTP/2 even apply"
caveat above was worth asking — this adopter has already moved past HTTP/2. What the data _does_
show: 4 of the 12 federation-manifest requests (all `-remoteEntry.js`, all fired in the same
~60-request burst as CSS/API calls) sat blocked for **~285-303ms** before the browser even began
sending them, while everything else in the same burst cleared in under 80ms. The other 8
federation-looking requests in the same capture cleared in under 10ms. The likely cause is
browser fetch-priority scheduling (non-render-blocking async scripts queue behind CSS/API calls),
not a hard stream ceiling — but the effect is the same either way: on this real production site,
some federated remote manifests deterministically pay a ~200-300ms queueing tax that a
single-bundle modulith structurally cannot incur, because it never has an equivalent redundant
manifest fetch waiting in line at all.

**To check your own site:** export a HAR the same way, run the script above against it, and look
at the same two things — protocol column (are you actually on HTTP/2, not HTTP/3 already?) and
whether your own `remoteEntry.js`/`mf-manifest.json` requests cluster at the high end of the
blocked-time ranking the way they did here.

### Forcing the stall in a controlled lab — causal, not just correlational

Lululemon's numbers are real but circumstantial: peak concurrency there (72) never actually
crossed the documented ceilings, so we can't rule out that something other than a hard stream cap
caused the delay. `apps/federation-shell/docs/stream-limit-lab/` closes that gap — a local Docker
Compose nginx serving our own built `federation-{shell,catalog,cart}` `dist/` output from one
origin (so every request shares one HTTP/2 connection, same as our real CloudFront deployment),
with `http2_max_concurrent_streams` deliberately set far below our own demo's ~15-request peak
concurrency. Change that **one number**, keep everything else identical, and the before/after
delta is causal.

**Chrome's own client-side cap can't be part of this experiment.** We checked: `net/spdy/spdy_session.cc`
defines `const size_t kMaxConcurrentStreamLimit = 256;` as a compile-time constant — no flag,
Finch feature, or runtime switch exists to lower it. Only the server-side knob is adjustable, which
is also the only side a web team actually controls in production anyway.

First attempt, with Chrome DevTools' "Fast 4G" throttling on, showed almost no difference (5ms vs
6ms average blocked time) — throttling paces requests client-side before they hit the wire, which
can mask true concurrency. Rerun with throttling off, cache disabled, same page (`/labs/federation/catalog`),
same machine, only `http2_max_concurrent_streams` changed — captured **4 independent trials per
cap** to rule out a one-off fluke:

|                                                                                                                               | cap = 128 (nginx default) | cap = 2              |
| ----------------------------------------------------------------------------------------------------------------------------- | ------------------------- | -------------------- |
| Burst-cluster blocked time (13-16 requests: `loadShare` chunks, `remoteEntry.js`, `hostInit`, index bundle), mean of 4 trials | 13.5ms (11.5-16.2ms)      | 34.5ms (26.6-40.5ms) |
| Average blocked time, all 58 requests, mean of 4 trials                                                                       | 4.5ms (4-5ms)             | 9.75ms (8-11ms)      |

Consistently **~2.2-2.6x** across every trial, same requests, same burst composition, same
everything else — no overlap between the two ranges. That's the causal proof Lululemon's numbers
alone couldn't provide. The absolute magnitude is modest
compared to Lululemon's ~285ms spikes — expected, since this lab runs over `localhost` with
near-zero round-trip time, so serializing ~13 excess requests behind a 2-stream cap adds only a
small multiple of a tiny per-request cost. Over a real network with real latency per request (like
Lululemon's), the same serialization compounds into hundreds of milliseconds instead of tens. The
mechanism is identical either way; only the network's own latency floor determines how dramatic it
looks.

Full reproduction steps (build → cert → `docker compose up` → capture → `analyze-har.mjs`) are in
`apps/federation-shell/docs/stream-limit-lab/README.md` — run it yourself, on your own machine, to
verify or to try other cap values.

---

## Footguns hit building this twin (real blog material)

Three genuine, non-obvious problems surfaced while building `federation` to be
functionally identical to `ui-modulith` — not contrived, just what happened:

1. **Cross-remote TypeScript types need a live server.**
   MF2's `dts` feature generates real types for a remote's exposed modules,
   but `consumeTypes` always fetches over HTTP (`node-fetch`) — no local-file
   fallback, confirmed via `FEDERATION_DEBUG=true`. `nx serve` (live remotes)
   gets real generated types; a cold CI build never can, short of standing up
   throwaway HTTP servers just to typecheck. Resolved with a `paths`-mapped
   fallback to a small hand-written ambient declaration, used only when the
   generated file is absent.

2. **Shared singletons must be declared on _every_ participant, symmetrically.**
   `i18next`/`react-i18next` were declared `shared` in catalog's and cart's
   config, but the _host_ (shell) config was missed. Silent failure: no build
   error, just `useTranslation` quietly returning raw i18n keys instead of
   translated text in the two remotes, while the shell's own use of the same
   hook worked fine. There's no single source of truth enforcing that every
   `federation()` config in the graph lists the same shared deps — it's
   copy-paste discipline, or nothing.

3. **Remote routing must be scoped to real files, not a whole path prefix.**
   The first cut routed all of `/labs/federation/catalog/*` to catalog's own
   S3 bucket. But `/catalog` and `/cart` are the _shell's_ internal SPA
   routes (just backed by separate remote bundles) — a direct
   navigation/refresh there rendered catalog's standalone placeholder instead
   of the shell's actual routed page. Fixed by scoping CloudFront's cache
   behaviors (and the edge function) to exactly `assets/*` and the literal
   `remoteEntry.js`, letting everything else fall through to the shell.

None of these are exotic — they're the direct, unavoidable cost of moving a
boundary that used to be enforced by the TypeScript compiler and one bundler
into three independently-configured build pipelines that have to agree with
each other by convention. `ui-modulith` structurally cannot have any of these
three bugs: there's one bundle, one shared module graph, one CI pipeline.

---

## Boundary enforcement, compared directly

|                                     | `ui-modulith`                                        | `federation`                                                                                               |
| ----------------------------------- | ---------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| What stops feature→feature imports  | `@nx/enforce-module-boundaries` — a real ESLint rule | nothing — there's no shared module graph to violate                                                        |
| When a violation is caught          | `nx lint`, in the PR                                 | never, structurally — but the _replacement_ risk (footgun #2 above) is a silent runtime regression instead |
| What a broken shared dep looks like | a compile error                                      | a blank translated string, or a 404 on `remoteEntry.js`, in production                                     |

The modulith trades runtime deployment independence for a compiler that
refuses to let boundaries rot. The federation twin trades that safety net for
genuine independent deploys — at the cost of every cross-cutting contract
(shared deps, kernel version, routing scope) now living in convention across
N separately-versioned configs instead of one lockstep build.

---

## Where this doc feeds the blog series

This file is the raw-data source for the "Modular Monolith vs. Module
Federation" post(s): the network numbers, the three footguns, and the HTTP/2
stream-limit research above are all real findings from this build, not
retrofitted narrative.

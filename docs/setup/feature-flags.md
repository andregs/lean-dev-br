# Feature Flags

## Architecture

Feature flags use [OpenFeature](https://openfeature.dev) (CNCF vendor-neutral API) backed by the built-in **InMemoryProvider**, populated from a `flags.json` file hosted on CloudFront.

```
flags.json (CloudFront /flags.json)
    ↓  fetched at boot
InMemoryProvider
    ↓  setProviderAndWait()
OpenFeature.getClient()  ← app code calls getBooleanValue(key, default)
```

### Why OpenFeature

App code is written against the OpenFeature API, not a specific vendor. When a flagd daemon (or Unleash) lands on the k8s box, swap the provider — no app-code change, no redeploy.

## Flag definition format

Flags are defined in [flagd schema](https://flagd.dev/reference/flag-definitions/) so the same file works with a future flagd daemon unchanged:

```json
{
  "flags": {
    "lang-toggle": {
      "state": "ENABLED",
      "variants": { "on": true, "off": false },
      "defaultVariant": "off"
    }
  }
}
```

`state: "DISABLED"` causes the flag to resolve to the caller's default value regardless of `defaultVariant`. A disabled flag is always off — there is no override mechanism.

## Where flags.json lives

| Env  | Location                                                                                                                                                              |
| ---- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Dev  | `apps/homepage/public/flags.json` — served at `/flags.json` by `pnpm nx serve homepage`.                                                                              |
| Prod | Same file, uploaded to S3 with the homepage static assets (`infra/homepage/hosting.ts` → `synced-folder`). Served via CloudFront at `https://lean.dev.br/flags.json`. |

Frontends receive the URL at build time via `VITE_FLAGS_URL` (CI injects it from the `VITE_FLAGS_URL` GitHub Actions variable). When absent, they fall back to `/flags.json`.

The Lambda (contact-api) receives it via the `FLAGS_URL` env var; when absent the flag client starts with an empty definition (all flags return their caller default).

## Adding a flag

1. Add the flag definition to `apps/homepage/public/flags.json`.
2. Consume in app code: `flags.getBooleanValue('my-flag', false)`.
3. Deploy with the next homepage build — CI uploads `flags.json` to S3 automatically.

## Kill-switch: flipping a flag in production

**To disable a feature immediately (rollback / incident):**

```bash
# 1. Edit flags.json — set defaultVariant to "off" or state to "DISABLED"
vim apps/homepage/public/flags.json

# 2. Upload to S3 (get the bucket name from Pulumi stack output)
aws s3 cp apps/homepage/public/flags.json \
  s3://$(pulumi -C infra/homepage stack output bucketName)/flags.json

# 3. Invalidate CloudFront so CDN edges serve the updated file immediately
aws cloudfront create-invalidation \
  --distribution-id $(pulumi -C infra/homepage stack output distributionId) \
  --paths /flags.json
```

CloudFront serves the new value within seconds. No app redeploy needed.

`flags.json` falls through to the default cache behavior (`CACHING_DISABLED` — not
edge-cached) and its `Cache-Control` header is `public, max-age=0, must-revalidate`, so
browsers also always revalidate; the invalidation step above only matters for the
CloudFront edge cache, not the browser.

## Future: targeting and % rollouts

When the k8s flagd daemon is available:

1. Replace `InMemoryProvider` with `@openfeature/flagd-web-provider` (browser) or
   `@openfeature/flagd-provider` (Node/Lambda) — no changes to any `getBooleanValue` call sites.
2. The same `flags.json` format is used by flagd natively.
3. Targeting rules (JSONLogic in flagd) and fractional/percentage rollouts become available.

No gRPC or additional packages are pulled in until this step.

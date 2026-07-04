---
title: 'CSP and Trusted Types across two stacks'
date: 2026-06-10T09:00:00.000Z
description: 'How we enforced a strict Content-Security-Policy with Trusted Types on a vanilla-JS site, then adapted that policy for a Next.js static-export blog — and what we had to give up.'
tags: ['security', 'csp', 'trusted-types', 'nextjs']
---

The apex homepage runs a strict Content-Security-Policy with Trusted Types enforced. Every DOM
script sink goes through a named policy; string-to-script coercion is blocked. Adding a Next.js
blog to the same domain forced us to decide which parts of that posture to keep, which to relax,
and why.

## Apex: full enforcement

The homepage is plain HTML + vanilla JS. No framework runtime, no inline scripts emitted at build.
That means we can afford a strict `script-src`:

```text
script-src 'self' https://www.google.com https://www.gstatic.com
```

No `'unsafe-inline'`. No nonce. Every script is a same-origin file or a known CDN.

Trusted Types is enforced with a named `app` policy and a strict `default`:

```js
tt.createPolicy('app', {
  createScriptURL: assertAllowedScriptURL, // reCAPTCHA only
});

tt.createPolicy('default', {
  createHTML: (s) => DOMPurify.sanitize(s, { RETURN_TRUSTED_TYPE: true }),
  createScriptURL: assertAllowedScriptURL,
  createScript: () => {
    throw new TypeError('blocked');
  },
});
```

The `default` policy is a real safety net. Any third-party code that hands a string to an `innerHTML`
sink gets sanitized rather than blocked, with a console warning. String-to-script coercion is hard-blocked.

## Blog: `'unsafe-inline'` is unavoidable

Next.js 16's static export (`output: 'export'`) inlines its RSC flight payload directly into each page:

```html
<script>
  (self.__next_f = self.__next_f || []).push([0]);
</script>
<script>
  self.__next_f.push([1, '...serialised RSC payload...']);
</script>
```

There are roughly six of these per page. Because it's a static export, there is no server to mint a
per-request nonce — so the canonical fix (nonce-based `script-src`) is off the table. `'unsafe-inline'`
is the only option.

This is a real relaxation. `'unsafe-inline'` means an XSS injection that places content into a `<script>`
tag executes. The mitigating factor here: all content on this blog is first-party markdown compiled at build
time. There is no user-supplied HTML reaching a script sink at runtime.

## The React 19 default-policy problem

Even with `'unsafe-inline'` in `script-src`, Trusted Types can still guard DOM sinks. The
`require-trusted-types-for 'script'` directive stays enforced.

But React 19's RSC client inserts those inline `<script>` nodes into the DOM by assigning to `innerHTML`.
If the Trusted Types `default` policy sanitizes HTML — as it does on the apex — DOMPurify strips the
`<script>` tag and React crashes at startup: the flight payload is never parsed.

The fix is a **pass-through** `createHTML` in the default policy for the blog:

```js
// 'framework' mode
tt.createPolicy('default', {
  createHTML: (s) => s, // pass-through — React's RSC flight only
  createScript: (s) => s,
  createScriptURL: assertAllowedScriptURL, // URL gating stays
});
```

Named policies are unaffected. The `app` policy still gates `createScriptURL`; the `dompurify` policy
still gates explicit `setHTML()` calls. Only the implicit default path — hit by React internally — is
relaxed.

Next also registers its own `nextjs` policy and reCAPTCHA registers `goog#html`. Both are listed in the `trusted-types` directive so the browser allows them:

```text
trusted-types app dompurify default goog#html nextjs
```

## Dev: report-only, not enforced

TT violations from Next's HMR injectors are noisy during `next dev`. We run Trusted Types
**report-only** on the Vite dev server and enforce it in prod only. The blog's `next.config.js`
injects the dev CSP via `async headers()` — ignored by `output: 'export'` at build time, so the
production CSP comes exclusively from CloudFront.

## Validating the prod posture

`next start` can't serve a static export, so the usual dev→prod flow has a gap.
The prod preview harness closes it:

```
pnpm nx run homepage:preview-all
```

This builds both apex and blog, then serves them from a single Node.js server on port 4173 with the
production CSP applied per section — apex headers for `/`, blog headers for `/blog/*` — and the same
edge routing logic that CloudFront runs. Open a post in Chrome with the console visible. Zero TT
violations confirm the prod posture before any deploy.

## Security posture, honestly

|                                | Apex        | Blog                       |
| ------------------------------ | ----------- | -------------------------- |
| `script-src 'unsafe-inline'`   | ✗           | ✓ (Next inline hydration)  |
| Trusted Types enforced         | ✓           | ✓                          |
| Default `createHTML` sanitizes | ✓           | ✗ (pass-through for React) |
| Script URL gated               | ✓           | ✓                          |
| Content origin                 | first-party | first-party, build-time    |

The blog's `createHTML` default is a pass-through. An `innerHTML` assignment that bypasses a named
policy is not sanitized. In practice this only happens inside React's flight client — all user-facing
content reaches the DOM via React's render path, not via runtime string injection. But the guarantee
is weaker than apex: it relies on the content being first-party, not on the TT machinery catching
bad strings.

The alternative — disabling Trusted Types entirely for `/blog/*` — would leave both the
script-URL and HTML-injection vectors unguarded. The current posture keeps URL gating, keeps
enforcement, and relaxes only the `createHTML` default where the framework requires it.

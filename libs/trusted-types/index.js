// @ts-check
// Shared Trusted Types setup — single source for the apex homepage and the blog.
// Registers a named `app` policy (explicit first-party script-URL injection) and
// a strict-functional `default` policy (sanitizes HTML via DOMPurify, allowlists
// script URLs, refuses string->script). Authored as ESM; consumed by Vite (apex)
// and Next (blog). The script-URL allowlist is per-app, passed by the caller.
import DOMPurify from 'dompurify';

// Tinyfill: on browsers without Trusted Types, shim `createPolicy` to return the
// rules object so callers use `policy.createX()` uniformly — a plain string here,
// a Trusted* object on TT-capable browsers — with no `if (trustedTypes)` branching.
// https://developer.mozilla.org/en-US/docs/Web/API/Trusted_Types_API#trusted_types_tinyfill
function ensureTinyfill() {
  if (typeof window.trustedTypes === 'undefined') {
    // @ts-expect-error — minimal shim, not the full TrustedTypePolicyFactory
    window.trustedTypes = { createPolicy: (_name, rules) => rules };
  }
}

/**
 * Build a script-URL asserter that passes only allowlisted prefixes.
 * @param {readonly string[]} allowlist
 * @returns {(url: string) => string}
 */
export function makeScriptUrlAsserter(allowlist) {
  return (url) => {
    if (allowlist.some((prefix) => url.startsWith(prefix))) return url;
    throw new TypeError(`Blocked script URL: ${url}`);
  };
}

/**
 * Sanitize untrusted HTML to a TrustedHTML (a string when TT is unavailable),
 * via DOMPurify's own `dompurify` policy.
 * @param {string} html
 * @returns {string}
 */
export function sanitizeHTML(html) {
  return /** @type {any} */ (DOMPurify.sanitize(html, { RETURN_TRUSTED_TYPE: true }));
}

/**
 * Sanitize and assign HTML to an element.
 * @param {HTMLElement} el
 * @param {string} html
 */
export function setHTML(el, html) {
  el.innerHTML = sanitizeHTML(html);
}

/**
 * Register the `app` + strict `default` Trusted Types policies. Returns the named
 * `app` policy, used explicitly by first-party code so legitimate usage never
 * trips the default policy's tech-debt warning.
 * `defaultPolicy`:
 *   - `'strict'` (apex): the default policy sanitizes HTML (DOMPurify), allowlists
 *     script URLs, and refuses string->script — a real safety net.
 *   - `'framework'` (Next/React blog): the default policy's createHTML/createScript
 *     pass through. React 19's RSC client materializes `<script>` nodes via
 *     `div.innerHTML = "<script></script>"`, so a sanitizing default would strip it
 *     and crash. HTML is therefore NOT sanitized by the default — only acceptable
 *     when the page renders first-party content. Script URLs stay allowlisted.
 *
 * @param {{ scriptUrlAllowlist?: readonly string[], defaultPolicy?: 'strict' | 'framework' }} [opts]
 */
export function installPolicies({ scriptUrlAllowlist = [], defaultPolicy = 'strict' } = {}) {
  ensureTinyfill();
  const tt = /** @type {NonNullable<Window['trustedTypes']>} */ (window.trustedTypes);
  const assertAllowedScriptURL = makeScriptUrlAsserter(scriptUrlAllowlist);

  const app = tt.createPolicy('app', {
    createScriptURL: assertAllowedScriptURL,
  });

  if (defaultPolicy === 'framework') {
    tt.createPolicy('default', {
      createHTML: (/** @type {string} */ s) => s,
      createScript: (/** @type {string} */ s) => s,
      createScriptURL: assertAllowedScriptURL,
    });
  } else {
    // Safety net for third-party code that hands a string to a script sink. It
    // still sanitizes HTML and allowlists script URLs — not a passthrough — and
    // warns so first-party callers relying on the implicit default get migrated.
    tt.createPolicy('default', {
      createHTML: (/** @type {string} */ s) => {
        console.warn(
          'TT default createHTML used — migrate caller to an explicit policy. value:',
          s,
        );
        return /** @type {any} */ (DOMPurify.sanitize(s, { RETURN_TRUSTED_TYPE: true }));
      },
      createScriptURL: (/** @type {string} */ s) => {
        console.debug('TT default createScriptURL (allowlisted third-party):', s);
        return assertAllowedScriptURL(s);
      },
      createScript: () => {
        throw new TypeError('TT default createScript blocked — no string-to-script coercion');
      },
    });
  }

  return app;
}

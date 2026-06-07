// @ts-check
import DOMPurify from 'dompurify';

// Tinyfill: on browsers without Trusted Types, shim `createPolicy` to return the
// rules object directly. Callers then use `policy.createX()` uniformly — it
// returns a plain string here and a Trusted* object on TT-capable browsers, so
// no `if (trustedTypes)` branching is needed at the call sites.
// https://developer.mozilla.org/en-US/docs/Web/API/Trusted_Types_API#trusted_types_tinyfill
if (typeof window.trustedTypes === 'undefined') {
  // @ts-expect-error — minimal shim, not the full TrustedTypePolicyFactory
  window.trustedTypes = { createPolicy: (_name, rules) => rules };
}

const tt = /** @type {NonNullable<Window['trustedTypes']>} */ (window.trustedTypes);

// Only reCAPTCHA scripts may be injected as TrustedScriptURL.
const SCRIPT_URL_ALLOWLIST = [
  'https://www.google.com/recaptcha/',
  'https://www.gstatic.com/recaptcha/',
];

/**
 * @param {string} url
 * @returns {string}
 */
function assertAllowedScriptURL(url) {
  if (SCRIPT_URL_ALLOWLIST.some((prefix) => url.startsWith(prefix))) return url;
  throw new TypeError(`Blocked script URL: ${url}`);
}

// Named policy used EXPLICITLY by our own code. Because our sinks go through
// this (not the implicit default), legitimate first-party usage never trips the
// tech-debt warning in the default policy below.
export const policy = tt.createPolicy('app', {
  createScriptURL: assertAllowedScriptURL,
});

// Strict-functional DEFAULT policy. Acts as a safety net for third-party code
// (reCAPTCHA, the RUM SDK) that hands a string to a script sink. It still
// sanitizes HTML and allowlists script URLs — it is NOT a passthrough — and it
// warns so we can find and migrate any first-party code path that relies on the
// implicit default instead of an explicit policy (tech debt).
tt.createPolicy('default', {
  createHTML: (/** @type {string} */ s) => {
    console.warn('TT default createHTML used — migrate caller to an explicit policy');
    return /** @type {any} */ (DOMPurify.sanitize(s, { RETURN_TRUSTED_TYPE: true }));
  },
  createScriptURL: (/** @type {string} */ s) => {
    console.warn('TT default createScriptURL used — migrate caller to an explicit policy');
    return assertAllowedScriptURL(s);
  },
  createScript: () => {
    throw new TypeError('TT default createScript blocked — no string-to-script coercion');
  },
});

/**
 * Sanitize untrusted HTML and assign it. DOMPurify (via its own `dompurify` TT
 * policy) returns a TrustedHTML when Trusted Types are enforced, satisfying the
 * sink without our own createHTML policy.
 *
 * @param {HTMLElement} el
 * @param {string} html
 */
export function setHTML(el, html) {
  el.innerHTML = /** @type {any} */ (DOMPurify.sanitize(html, { RETURN_TRUSTED_TYPE: true }));
}

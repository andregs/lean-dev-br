// Single source of truth for the site's Content-Security-Policy.
//
// Consumed by both the Pulumi/CloudFront prod config (infra/homepage/hosting.ts)
// and the Vite dev server (apps/homepage/vite.config.ts) so the two never drift.
// Authored as plain CommonJS with no build step so it resolves identically under
// Pulumi (ts-node) and Vite (esbuild) without tsconfig path or ESM/CJS gymnastics.

const TRUSTED_TYPES_POLICIES = ['app', 'dompurify', 'default', 'goog#html', 'nextjs'];

/**
 * CSP directives as data. Prod is the canonical baseline; dev layers on the
 * minimum relaxations Vite needs (HMR websocket + localhost asset requests).
 * `app: 'blog'` allows inline scripts: the Next.js static export inlines its
 * hydration scripts and there's no server to mint a nonce. Trusted Types still
 * guards DOM script sinks; the apex app (no inline scripts) stays strict.
 * `app: 'todo'` drops reCAPTCHA/RUM/Cognito domains; adds `signalUrl` to
 * connect-src for the encrypted Yjs blob relay (Cloud Run relay-service).
 *
 * @param {{ mode: 'prod' | 'dev', app?: 'apex' | 'blog' | 'todo' | 'ui-modulith', signalUrl?: string }} opts
 * @returns {Record<string, string[]>}
 */
function cspDirectives({ mode, app = 'apex', signalUrl = '' }) {
  const isTodo = app === 'todo';
  const isModulith = app === 'ui-modulith';

  const connectSrc = ["'self'"];
  if (!isTodo && !isModulith) {
    // reCAPTCHA uses google.com — modulith has no reCAPTCHA
    connectSrc.push('https://www.google.com');
  }
  if (!isModulith) {
    // RUM and Cognito not used by the modulith lab
    connectSrc.push(
      'https://dataplane.rum.us-east-1.amazonaws.com',
      'https://cognito-identity.us-east-1.amazonaws.com',
    );
  }
  if (isTodo && signalUrl) {
    connectSrc.push(signalUrl);
  }
  if (mode === 'dev') {
    connectSrc.push('ws://localhost:*', 'http://localhost:*');
  }

  const scriptSrc = ["'self'"];
  if (!isTodo && !isModulith) {
    // reCAPTCHA scripts — todo and modulith have no reCAPTCHA
    scriptSrc.push('https://www.google.com', 'https://www.gstatic.com');
  }
  // Blog (Next.js static export) and ui-modulith dev (Vite React Fast Refresh preamble)
  // both require unsafe-inline in script-src.
  if (app === 'blog' || (isModulith && mode === 'dev')) {
    scriptSrc.push("'unsafe-inline'");
  }

  /** @type {Record<string, string[]>} */
  const directives = {
    'default-src': ["'self'"],
    'script-src': scriptSrc,
    'connect-src': connectSrc,
    'img-src': ["'self'", 'data:'],
    'style-src': ["'self'", "'unsafe-inline'"],
    'font-src': ["'self'"],
  };
  if (!isTodo && !isModulith) {
    // reCAPTCHA uses a Google iframe — todo and modulith have no reCAPTCHA iframe
    directives['frame-src'] = ['https://www.google.com'];
  }
  if (isModulith) {
    // MSW service worker requires an explicit worker-src; same-origin only
    directives['worker-src'] = ["'self'"];
  }
  return directives;
}

/**
 * The Trusted Types directive, shared by the enforced and report-only headers.
 * @returns {string}
 */
function trustedTypesDirective() {
  return `require-trusted-types-for 'script'; trusted-types ${TRUSTED_TYPES_POLICIES.join(' ')}`;
}

/**
 * @param {Record<string, string[]>} directives
 * @returns {string}
 */
function serialize(directives) {
  return Object.entries(directives)
    .map(([name, values]) => `${name} ${values.join(' ')}`)
    .join('; ');
}

/**
 * Build the enforced CSP header value for a mode. Prod inlines (enforces) the
 * Trusted Types directive; dev omits it here — ship `trustedTypesDirective()` as
 * a separate report-only header instead so dev tooling isn't blocked.
 *
 * @param {{ mode: 'prod' | 'dev', app?: 'apex' | 'blog' | 'todo' | 'ui-modulith', signalUrl?: string }} opts
 * @returns {string}
 */
function cspHeader({ mode, app = 'apex', signalUrl = '' }) {
  const base = serialize(cspDirectives({ mode, app, signalUrl }));
  return mode === 'prod' ? `${base}; ${trustedTypesDirective()}` : base;
}

module.exports = { cspDirectives, trustedTypesDirective, cspHeader };

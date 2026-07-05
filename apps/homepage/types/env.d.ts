/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Public reCAPTCHA v3 site key, injected at build time. */
  readonly VITE_RECAPTCHA_SITE_KEY: string;
  /** URL of flags.json on CloudFront; falls back to /flags.json when absent. */
  readonly VITE_FLAGS_URL?: string;
  /** Release identifier (git SHA) tagged on Faro events; correlates with uploaded sourcemaps. */
  readonly VITE_APP_VERSION?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

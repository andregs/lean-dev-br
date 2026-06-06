/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Public reCAPTCHA v3 site key, injected at build time. */
  readonly VITE_RECAPTCHA_SITE_KEY: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Public reCAPTCHA v3 site key, injected at build time. */
  readonly VITE_RECAPTCHA_SITE_KEY: string;
  /** URL of flags.json on CloudFront; falls back to /flags.json when absent. */
  readonly VITE_FLAGS_URL?: string;
  /** CloudWatch RUM app monitor GUID (Pulumi output). */
  readonly VITE_RUM_APP_MONITOR_ID?: string;
  /** Cognito identity pool ID authorizing RUM events (Pulumi output). */
  readonly VITE_RUM_IDENTITY_POOL_ID?: string;
  /** RUM session sampling rate 0.0–1.0; defaults to 0.1 if unset. */
  readonly VITE_RUM_SESSION_SAMPLE_RATE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

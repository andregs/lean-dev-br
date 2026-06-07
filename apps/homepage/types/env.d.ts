/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Public reCAPTCHA v3 site key, injected at build time. */
  readonly VITE_RECAPTCHA_SITE_KEY: string;
  /** CloudWatch RUM app monitor GUID (Pulumi output). */
  readonly VITE_RUM_APP_MONITOR_ID?: string;
  /** Cognito identity pool ID authorizing RUM events (Pulumi output). */
  readonly VITE_RUM_IDENTITY_POOL_ID?: string;
  /** Guest IAM role ARN for RUM (Pulumi output). */
  readonly VITE_RUM_GUEST_ROLE_ARN?: string;
  /** RUM session sampling rate 0.0–1.0; defaults to 0.1 if unset. */
  readonly VITE_RUM_SESSION_SAMPLE_RATE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

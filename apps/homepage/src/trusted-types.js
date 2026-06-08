// @ts-check
import { installPolicies, setHTML } from '@lean-dev-br/trusted-types';

// Only reCAPTCHA scripts may be injected as a TrustedScriptURL.
const SCRIPT_URL_ALLOWLIST = [
  'https://www.google.com/recaptcha/',
  'https://www.gstatic.com/recaptcha/',
];

// Register the shared `app` + strict `default` policies with apex's allowlist.
// `policy` is used explicitly by first-party code (contact-form reCAPTCHA loader).
export const policy = installPolicies({ scriptUrlAllowlist: SCRIPT_URL_ALLOWLIST });

export { setHTML };

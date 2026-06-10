export interface AppPolicy {
  createScriptURL(url: string): string;
}

export function makeScriptUrlAsserter(allowlist: readonly string[]): (url: string) => string;
export function sanitizeHTML(html: string): string;
export function setHTML(el: HTMLElement, html: string): void;
export function installPolicies(opts?: {
  scriptUrlAllowlist?: readonly string[];
  defaultPolicy?: 'strict' | 'framework';
}): AppPolicy;

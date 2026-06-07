import type { TrustedTypePolicyFactory } from 'trusted-types/lib';

// lib.dom in this TS version predates the Trusted Types API, so augment Window
// with the factory provided by @types/trusted-types (a transitive dep of
// DOMPurify's own type definitions).
declare global {
  interface Window {
    trustedTypes?: TrustedTypePolicyFactory;
  }
}

export {};

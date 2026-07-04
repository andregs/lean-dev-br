// @ts-check
/** @import { FlagsJson } from './index.js' */
// Server-side (Node/Lambda) OpenFeature flag client.
// Uses @openfeature/server-sdk rather than the browser SDK; the flagd-schema
// adapter and public API are identical to the browser entry (index.js).
//
// Future: swap InMemoryProvider → @openfeature/flagd-provider when a flagd
// daemon lands on the k8s box. No app-code change needed.

import { OpenFeature, TypedInMemoryProvider } from '@openfeature/server-sdk';
import { flagdToInMemory } from './_adapter.js';

/**
 * Create a server-side OpenFeature client backed by InMemoryProvider loaded
 * from a flagd-schema flags.json object.
 *
 * A DISABLED flag always resolves to the caller's default value.
 *
 * @param {FlagsJson} flagsJson
 * @returns {Promise<import('@openfeature/server-sdk').Client>}
 */
export async function createFlagClient(flagsJson) {
  // flagdToInMemory returns the right shape at runtime; cast needed because
  // FlagVariants is a discriminated union that Record<string,unknown> can't satisfy statically.
  await OpenFeature.setProviderAndWait(
    new TypedInMemoryProvider(/** @type {any} */ (flagdToInMemory(flagsJson))),
  );
  return OpenFeature.getClient();
}

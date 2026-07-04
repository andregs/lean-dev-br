// @ts-check
/** @import { FlagsJson } from './index.js' */
// Browser feature-flag client built on OpenFeature (vendor-neutral API) +
// InMemoryProvider. For the Node/Lambda entry see ./server.js.
//
// Flag-definition format (flagd schema — forward-compatible with a flagd daemon):
//   { "flags": { "<key>": { "state": "ENABLED" | "DISABLED",
//                            "variants": { "<name>": <value>, ... },
//                            "defaultVariant": "<name>" } } }
//
// Flag config:
//   Dev  — edit apps/homepage/public/flags.json, reload.
//   Prod — edit flags.json → s3 cp → cloudfront create-invalidation /flags.json.
//
// Future: swap InMemoryProvider → @openfeature/flagd-web-provider when a flagd
// daemon lands on the k8s box. No app-code change needed.

import { OpenFeature, TypedInMemoryProvider } from '@openfeature/web-sdk';
import { flagdToInMemory } from './_adapter.js';

/**
 * Create an OpenFeature client backed by InMemoryProvider loaded from a
 * flagd-schema flags.json object.
 *
 * A DISABLED flag always resolves to the caller's default value.
 *
 * @param {FlagsJson} flagsJson
 * @returns {Promise<import('@openfeature/web-sdk').Client>}
 */
export async function createFlagClient(flagsJson) {
  // flagdToInMemory returns the right shape at runtime; cast needed because
  // FlagVariants is a discriminated union that Record<string,unknown> can't satisfy statically.
  await OpenFeature.setProviderAndWait(
    new TypedInMemoryProvider(/** @type {any} */ (flagdToInMemory(flagsJson))),
  );
  return OpenFeature.getClient();
}

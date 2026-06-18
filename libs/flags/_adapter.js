// @ts-check
/** @import { FlagsJson } from './index.js' */
// Shared adapter: converts flagd-schema flags.json → OpenFeature InMemoryProvider map.
// Used by both the browser entry (index.js) and the server entry (server.js).

/**
 * @typedef {{ disabled?: boolean; variants: Record<string, unknown>; defaultVariant: string }} FlagEntry
 */

/**
 * Convert a flagd-schema flags.json to the shape OpenFeature InMemoryProvider expects.
 *
 * @param {FlagsJson} flagsJson
 * @returns {Record<string, FlagEntry>}
 */
export function flagdToInMemory(flagsJson) {
  /** @type {Record<string, FlagEntry>} */
  const map = {};
  const defs = flagsJson?.flags ?? {};
  for (const [key, def] of Object.entries(defs)) {
    map[key] = {
      disabled: def.state === 'DISABLED',
      variants: def.variants,
      defaultVariant: def.defaultVariant,
    };
  }
  return map;
}

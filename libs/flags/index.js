// @ts-check
/** @import { FlagsJson, Overrides, FlagClient } from './index.js' */
// Thin feature-flag client. Uses flagd flag-definition format so it is
// portable to a real flagd daemon (via @openfeature/flagd-provider) later.
//
// Flag-definition format (flagd schema):
//   { "flags": { "<key>": { "state": "ENABLED" | "DISABLED",
//                            "variants": { "<name>": <value>, ... },
//                            "defaultVariant": "<name>" } } }
//
// Override precedence: URL query param > localStorage > flags.json default.
// Query params : ?ff_<key>=on|off|clear   ("clear" removes the stored override)
// localStorage : ff_<key> = "on" | "off" | "<string-value>"

const LS_PREFIX = 'ff_';
const QS_PREFIX = 'ff_';

/** @returns {Storage | null} */
function storage() {
  try {
    return typeof localStorage !== 'undefined' && typeof localStorage.setItem === 'function'
      ? localStorage
      : null;
  } catch {
    return null;
  }
}

/**
 * Parse override values from a URL query string.
 * Side-effect in browser: persists on/off overrides to localStorage;
 * `?ff_<key>=clear` removes the stored override.
 *
 * @param {string} [search] defaults to `window.location.search` in browser
 * @returns {Overrides}
 */
export function parseOverrides(search) {
  const src = search ?? (typeof window !== 'undefined' ? window.location.search : '');
  const params = new URLSearchParams(src);
  /** @type {Overrides} */
  const overrides = {};
  for (const [rawKey, val] of params) {
    if (!rawKey.startsWith(QS_PREFIX)) continue;
    const key = rawKey.slice(QS_PREFIX.length);
    if (val === 'clear') {
      storage()?.removeItem(LS_PREFIX + key);
    } else if (val === 'on' || val === 'true') {
      overrides[key] = true;
      storage()?.setItem(LS_PREFIX + key, 'on');
    } else if (val === 'off' || val === 'false') {
      overrides[key] = false;
      storage()?.setItem(LS_PREFIX + key, 'off');
    } else {
      overrides[key] = val;
      storage()?.setItem(LS_PREFIX + key, val);
    }
  }
  return overrides;
}

/**
 * Load override values previously persisted to localStorage.
 * @returns {Overrides}
 */
export function loadStoredOverrides() {
  const store = storage();
  if (!store) return {};
  /** @type {Overrides} */
  const overrides = {};
  for (let i = 0; i < store.length; i++) {
    const rawKey = store.key(i);
    if (!rawKey?.startsWith(LS_PREFIX)) continue;
    const key = rawKey.slice(LS_PREFIX.length);
    const val = store.getItem(rawKey);
    if (val === 'on') overrides[key] = true;
    else if (val === 'off') overrides[key] = false;
    else if (val !== null) overrides[key] = val;
  }
  return overrides;
}

/**
 * Create a flag client from a flagd-format JSON object.
 *
 * @param {FlagsJson} flagsJson
 * @param {{ overrides?: Overrides }} [opts]
 * @returns {FlagClient}
 */
export function createFlagClient(flagsJson, opts = {}) {
  const defs = flagsJson?.flags ?? {};
  const overrides = opts.overrides ?? {};

  /** @param {string} key @returns {unknown} */
  function resolve(key) {
    if (key in overrides) return overrides[key];
    const def = defs[key];
    if (!def || def.state === 'DISABLED') return undefined;
    return def.variants[def.defaultVariant];
  }

  return {
    getBooleanValue(key, defaultValue) {
      const val = resolve(key);
      return typeof val === 'boolean' ? val : defaultValue;
    },
    getStringValue(key, defaultValue) {
      const val = resolve(key);
      return typeof val === 'string' ? val : defaultValue;
    },
  };
}

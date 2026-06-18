#!/usr/bin/env node
// Verify that en-US and pt-BR locale files have identical key sets.
// Merges each file's keys with the shared catalog keys before comparing.
//
// Usage: node libs/i18n/check-parity.mjs <locales-dir>
//   e.g. node libs/i18n/check-parity.mjs apps/homepage/src/locales

import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { sharedCatalog } from './index.js';

const localesDir = process.argv[2];
if (!localesDir) {
  console.error('Usage: check-parity.mjs <locales-dir>');
  process.exit(2);
}

const dir = resolve(process.cwd(), localesDir);

/** @param {string} locale */
function loadKeys(locale) {
  const file = join(dir, `${locale}.json`);
  let app;
  try {
    app = JSON.parse(readFileSync(file, 'utf8'));
  } catch {
    console.error(`Cannot read ${file}`);
    process.exit(2);
  }
  return new Set([
    ...Object.keys(
      sharedCatalog[
        /** @type {import('./index.js').Locale} */ (locale === 'en-US' ? 'en-US' : 'pt-BR')
      ],
    ),
    ...Object.keys(app),
  ]);
}

const enKeys = loadKeys('en-US');
const ptKeys = loadKeys('pt-BR');

const onlyEn = [...enKeys].filter((k) => !ptKeys.has(k));
const onlyPt = [...ptKeys].filter((k) => !enKeys.has(k));

if (onlyEn.length === 0 && onlyPt.length === 0) {
  console.log(`✓ i18n parity OK (${enKeys.size} keys) — ${localesDir}`);
  process.exit(0);
}

if (onlyEn.length > 0) {
  console.error(`✗ Keys in en-US but missing from pt-BR (${localesDir}):`);
  for (const k of onlyEn) console.error(`  - ${k}`);
}
if (onlyPt.length > 0) {
  console.error(`✗ Keys in pt-BR but missing from en-US (${localesDir}):`);
  for (const k of onlyPt) console.error(`  - ${k}`);
}
process.exit(1);

package br.dev.lean.wanderlust.catalog;

import java.util.Map;

/** Mirrors the flagd-schema {@code flags.json} shape (see {@code libs/flags/_adapter.js}). */
record FlagsJson(Map<String, FlagDef> flags) {
  record FlagDef(String state, Map<String, Object> variants, String defaultVariant) {}
}

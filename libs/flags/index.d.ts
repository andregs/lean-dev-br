import type { Client } from '@openfeature/web-sdk';

export interface FlagDef {
  state: 'ENABLED' | 'DISABLED';
  variants: Record<string, unknown>;
  defaultVariant: string;
}

export interface FlagsJson {
  flags: Record<string, FlagDef>;
}

/** OpenFeature Client — use getBooleanValue(key, default) / getStringValue(key, default). */
export type FlagClient = Client;

export function createFlagClient(flagsJson: FlagsJson): Promise<FlagClient>;

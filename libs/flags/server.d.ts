import type { Client } from '@openfeature/server-sdk';
import type { FlagsJson } from './index.js';

export { FlagsJson };

/** Server-side OpenFeature Client (Node/Lambda). */
export type FlagClient = Client;

export function createFlagClient(flagsJson: FlagsJson): Promise<FlagClient>;

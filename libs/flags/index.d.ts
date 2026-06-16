export interface FlagDef {
  state: 'ENABLED' | 'DISABLED';
  variants: Record<string, unknown>;
  defaultVariant: string;
}

export interface FlagsJson {
  flags: Record<string, FlagDef>;
}

export type Overrides = Record<string, boolean | string>;

export interface FlagClient {
  getBooleanValue(key: string, defaultValue: boolean): boolean;
  getStringValue(key: string, defaultValue: string): string;
}

export function parseOverrides(search?: string): Overrides;
export function loadStoredOverrides(): Overrides;
export function createFlagClient(flagsJson: FlagsJson, opts?: { overrides?: Overrides }): FlagClient;

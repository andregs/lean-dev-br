export type CspMode = 'prod' | 'dev';

export function cspDirectives(opts: { mode: CspMode }): Record<string, string[]>;
export function trustedTypesDirective(): string;
export function cspHeader(opts: { mode: CspMode }): string;

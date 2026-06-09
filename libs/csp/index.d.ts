export type CspMode = 'prod' | 'dev';
export type CspApp = 'apex' | 'blog';

export function cspDirectives(opts: { mode: CspMode; app?: CspApp }): Record<string, string[]>;
export function trustedTypesDirective(): string;
export function cspHeader(opts: { mode: CspMode; app?: CspApp }): string;

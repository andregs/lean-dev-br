export type CspMode = 'prod' | 'dev';
export type CspApp = 'apex' | 'blog' | 'todo';

export function cspDirectives(opts: { mode: CspMode; app?: CspApp; signalUrl?: string }): Record<string, string[]>;
export function trustedTypesDirective(): string;
export function cspHeader(opts: { mode: CspMode; app?: CspApp; signalUrl?: string }): string;

export interface AwsRumClientConfig {
  sessionSampleRate: number;
  identityPoolId: string;
  endpoint: string;
  telemetries: string[];
  allowCookies: boolean;
  enableXRay: boolean;
}

export interface RumConfig {
  appMonitorId: string;
  appVersion: string;
  region: string;
  config: AwsRumClientConfig;
}

export function rumConfig(opts: {
  appMonitorId?: string;
  identityPoolId?: string;
  sampleRate?: number;
  region?: string;
}): RumConfig | null;

export const REGION: string;
export const APP_VERSION: string;

import { describe, expect, it } from 'vitest';
import { rumConfig, REGION, APP_VERSION } from './index.js';

const valid = {
  appMonitorId: 'abc-123',
  identityPoolId: 'us-east-1:pool',
  sampleRate: 0.1,
};

describe('rumConfig', () => {
  it('builds the AwsRum args from per-app identifiers', () => {
    const r = rumConfig(valid);
    expect(r).not.toBeNull();
    expect(r).toMatchObject({
      appMonitorId: 'abc-123',
      appVersion: APP_VERSION,
      region: REGION,
      config: {
        sessionSampleRate: 0.1,
        identityPoolId: 'us-east-1:pool',
        endpoint: `https://dataplane.rum.${REGION}.amazonaws.com`,
        allowCookies: false,
        enableXRay: false,
      },
    });
  });

  it('returns null when any required field is missing or non-finite', () => {
    expect(rumConfig({ ...valid, appMonitorId: undefined })).toBeNull();
    expect(rumConfig({ ...valid, identityPoolId: undefined })).toBeNull();
    expect(rumConfig({ ...valid, sampleRate: Number.NaN })).toBeNull();
  });
});

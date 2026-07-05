import * as aws from '@pulumi/aws';
import * as pulumi from '@pulumi/pulumi';
import { createApi } from './api';
import { createEmail } from './email';
import { createHosting } from './hosting';

const config = new pulumi.Config();
const domain = config.require('domain');
const notifyEmail = config.requireSecret('notifyEmail');
const recaptchaSecret = config.requireSecret('recaptchaSecret');

// CSP-report endpoint guardrails (server-side). Single source of truth is the
// stack config (see Pulumi.<stack>.yaml) — required, no in-code defaults.
const cspReportRateLimit = config.requireNumber('cspReportRateLimit');
const cspReportBurstLimit = config.requireNumber('cspReportBurstLimit');
const cspReportMaxBytes = config.requireNumber('cspReportMaxBytes');

// reCAPTCHA verification tunables — tweaked occasionally, so externalized.
const recaptchaMinScore = config.requireNumber('recaptchaMinScore');
const recaptchaAction = config.require('recaptchaAction');

// ACK disabled while SES is in sandbox. Flip to true after SES production access is granted.
const sendAck = config.requireBoolean('sendAck');

// Cloud Run URL for the relay-service. Set after the GCP stack is deployed.
// Empty string → todo CSP omits the signal URL (sync fails gracefully; local writes still work).
const relayServiceUrl = config.get('relayServiceUrl') ?? '';

// Grafana Faro collector — not a secret (it ships to browsers via the app-key
// in the path anyway), externalized so the zone/app can be rotated without a
// code change. See docs/setup/observability.md.
const faroCollectorHost = config.require('faroCollectorHost');
const faroCollectorPath = config.require('faroCollectorPath');

const zone = new aws.route53.Zone('zone', { name: domain });

createEmail({ zone, domain });

const { apiEndpoint, executeApiDomain } = createApi({
  notifyEmail,
  recaptchaSecret,
  domain,
  cspReportRateLimit,
  cspReportBurstLimit,
  cspReportMaxBytes,
  recaptchaMinScore,
  recaptchaAction,
  sendAck,
});

const { bucketName, distributionId, distributionDomain } = createHosting({
  zone,
  domain,
  executeApiDomain,
  relayServiceUrl,
  faroCollectorHost,
  faroCollectorPath,
});

export { apiEndpoint, bucketName, distributionDomain, distributionId };
export const nameservers = zone.nameServers;
export const sesDomainIdentity = domain;

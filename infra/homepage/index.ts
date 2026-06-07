import * as aws from "@pulumi/aws";
import * as pulumi from "@pulumi/pulumi";
import { createEmail } from "./email";
import { createApi } from "./api";
import { createHosting } from "./hosting";
import { createObservability } from "./observability";

const config = new pulumi.Config();
const domain = config.require("domain");
const notifyEmail = config.requireSecret("notifyEmail");
const recaptchaSecret = config.requireSecret("recaptchaSecret");

// CSP-report endpoint guardrails (server-side). Single source of truth is the
// stack config (see Pulumi.<stack>.yaml) — required, no in-code defaults.
const cspReportRateLimit = config.requireNumber("cspReportRateLimit");
const cspReportBurstLimit = config.requireNumber("cspReportBurstLimit");
const cspReportMaxBytes = config.requireNumber("cspReportMaxBytes");

// reCAPTCHA verification tunables — tweaked occasionally, so externalized.
const recaptchaMinScore = config.requireNumber("recaptchaMinScore");
const recaptchaAction = config.require("recaptchaAction");

const zone = new aws.route53.Zone("zone", { name: domain });

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
});

const { bucketName, distributionId, distributionDomain } = createHosting({
  zone,
  domain,
  executeApiDomain,
});

const { identityPoolId, guestRoleArn, appMonitorId } = createObservability({ domain });

export { bucketName, distributionId, distributionDomain, apiEndpoint };
export { identityPoolId, guestRoleArn, appMonitorId };
export const nameservers = zone.nameServers;
export const sesDomainIdentity = domain;

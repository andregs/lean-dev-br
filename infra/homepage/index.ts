import * as aws from "@pulumi/aws";
import * as pulumi from "@pulumi/pulumi";
import { createEmail } from "./email";
import { createApi } from "./api";
import { createHosting } from "./hosting";

const config = new pulumi.Config();
const domain = config.require("domain");
const notifyEmail = config.requireSecret("notifyEmail");
const recaptchaSecret = config.requireSecret("recaptchaSecret");

const zone = new aws.route53.Zone("zone", { name: domain });

createEmail({ zone, domain });

const { apiEndpoint, executeApiDomain } = createApi({
  notifyEmail,
  recaptchaSecret,
  domain,
});

const { bucketName, distributionId, distributionDomain } = createHosting({
  zone,
  domain,
  executeApiDomain,
});

export { bucketName, distributionId, distributionDomain, apiEndpoint };
export const nameservers = zone.nameServers;
export const sesDomainIdentity = domain;

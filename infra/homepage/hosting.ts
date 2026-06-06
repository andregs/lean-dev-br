import * as fs from "fs";
import * as aws from "@pulumi/aws";
import * as pulumi from "@pulumi/pulumi";
import { S3BucketFolder } from "@pulumi/synced-folder";

// AWS managed cache policy IDs
const CACHING_DISABLED_POLICY_ID = "4135ea2d-6df8-44a3-9df3-4b5a84be39ad";
const CACHING_OPTIMIZED_POLICY_ID = "658327ea-f89d-4fab-a63d-7e88639e58f6";
// Forwards all viewer headers except Host — required for custom API GW origins
const ALL_VIEWER_EXCEPT_HOST_HEADER_POLICY_ID =
  "b689b0a8-53d0-40ab-baf2-68738e2966ac";

interface HostingArgs {
  zone: aws.route53.Zone;
  domain: string;
  executeApiDomain: pulumi.Output<string>;
}

export function createHosting({ zone, domain, executeApiDomain }: HostingArgs) {
  const wwwDomain = `www.${domain}`;

  const usEast1 = new aws.Provider("us-east-1", { region: "us-east-1" });

  const cert = new aws.acm.Certificate(
    "cert",
    {
      domainName: domain,
      subjectAlternativeNames: [wwwDomain],
      validationMethod: "DNS",
    },
    { provider: usEast1 }
  );

  const certValidationRecords = cert.domainValidationOptions.apply((options) => {
    const seen = new Set<string>();
    return options
      .filter((opt) => {
        if (seen.has(opt.resourceRecordName)) return false;
        seen.add(opt.resourceRecordName);
        return true;
      })
      .map(
        (opt) =>
          new aws.route53.Record(
            `cert-validation-${opt.domainName.replace(/\./g, "-")}`,
            {
              name: opt.resourceRecordName,
              type: opt.resourceRecordType,
              zoneId: zone.zoneId,
              records: [opt.resourceRecordValue],
              ttl: 60,
            }
          )
      );
  });

  const certValidation = new aws.acm.CertificateValidation(
    "cert-validation",
    {
      certificateArn: cert.arn,
      validationRecordFqdns: certValidationRecords.apply((records) =>
        records.map((r) => r.fqdn)
      ),
    },
    { provider: usEast1 }
  );

  const bucket = new aws.s3.BucketV2("bucket", {
    bucket: "lean-dev-br-homepage",
    forceDestroy: true,
  });

  new aws.s3.BucketPublicAccessBlock("bucket-public-access-block", {
    bucket: bucket.id,
    blockPublicAcls: true,
    blockPublicPolicy: true,
    ignorePublicAcls: true,
    restrictPublicBuckets: true,
  });

  const bucketOwnership = new aws.s3.BucketOwnershipControls("bucket-ownership", {
    bucket: bucket.id,
    rule: { objectOwnership: "BucketOwnerPreferred" },
  });

  const oac = new aws.cloudfront.OriginAccessControl("oac", {
    name: "lean-dev-br-homepage-oac",
    originAccessControlOriginType: "s3",
    signingBehavior: "always",
    signingProtocol: "sigv4",
  });

  // www → apex redirect + SPA fallback for History API routes
  const edgeFn = new aws.cloudfront.Function("edge-fn", {
    runtime: "cloudfront-js-2.0",
    code: fs.readFileSync("cloudfront-edge.js", "utf-8"),
    publish: true,
  });

  const responseHeadersPolicy = new aws.cloudfront.ResponseHeadersPolicy(
    "response-headers-policy",
    {
      name: "lean-dev-br-security-headers",
      securityHeadersConfig: {
        contentTypeOptions: { override: true },
        frameOptions: { frameOption: "DENY", override: true },
        xssProtection: { protection: true, modeBlock: true, override: true },
        referrerPolicy: {
          referrerPolicy: "strict-origin-when-cross-origin",
          override: true,
        },
        strictTransportSecurity: {
          accessControlMaxAgeSec: 31536000,
          includeSubdomains: true,
          preload: true,
          override: true,
        },
        contentSecurityPolicy: {
          contentSecurityPolicy: [
            "default-src 'self'",
            "script-src 'self' https://www.google.com https://www.gstatic.com",
            "frame-src https://www.google.com",
            "connect-src 'self'",
            "img-src 'self' data:",
            "style-src 'self' 'unsafe-inline'",
            "font-src 'self'",
          ].join("; "),
          override: true,
        },
      },
    }
  );

  const distribution = new aws.cloudfront.Distribution("distribution", {
    enabled: true,
    defaultRootObject: "index.html",
    aliases: [domain, wwwDomain],
    origins: [
      {
        originId: "s3",
        domainName: bucket.bucketRegionalDomainName,
        originAccessControlId: oac.id,
      },
      {
        originId: "api",
        domainName: executeApiDomain,
        customOriginConfig: {
          httpPort: 80,
          httpsPort: 443,
          originProtocolPolicy: "https-only",
          originSslProtocols: ["TLSv1.2"],
        },
      },
    ],
    orderedCacheBehaviors: [
      {
        pathPattern: "/api/*",
        targetOriginId: "api",
        viewerProtocolPolicy: "https-only",
        allowedMethods: ["DELETE", "GET", "HEAD", "OPTIONS", "PATCH", "POST", "PUT"],
        cachedMethods: ["GET", "HEAD"],
        cachePolicyId: CACHING_DISABLED_POLICY_ID,
        originRequestPolicyId: ALL_VIEWER_EXCEPT_HOST_HEADER_POLICY_ID,
        compress: true,
      },
      {
        pathPattern: "/assets/*",
        targetOriginId: "s3",
        viewerProtocolPolicy: "redirect-to-https",
        allowedMethods: ["GET", "HEAD"],
        cachedMethods: ["GET", "HEAD"],
        cachePolicyId: CACHING_OPTIMIZED_POLICY_ID,
        responseHeadersPolicyId: responseHeadersPolicy.id,
        compress: true,
      },
    ],
    defaultCacheBehavior: {
      targetOriginId: "s3",
      viewerProtocolPolicy: "redirect-to-https",
      allowedMethods: ["GET", "HEAD"],
      cachedMethods: ["GET", "HEAD"],
      cachePolicyId: CACHING_DISABLED_POLICY_ID,
      responseHeadersPolicyId: responseHeadersPolicy.id,
      compress: true,
      functionAssociations: [
        {
          eventType: "viewer-request",
          functionArn: edgeFn.arn,
        },
      ],
    },
    priceClass: "PriceClass_100",
    viewerCertificate: {
      acmCertificateArn: certValidation.certificateArn,
      sslSupportMethod: "sni-only",
      minimumProtocolVersion: "TLSv1.2_2021",
    },
    restrictions: {
      geoRestriction: { restrictionType: "none" },
    },
  });

  new aws.s3.BucketPolicy("bucket-policy", {
    bucket: bucket.id,
    policy: pulumi.all([bucket.arn, distribution.arn]).apply(
      ([bucketArn, distributionArn]) =>
        JSON.stringify({
          Version: "2012-10-17",
          Statement: [
            {
              Sid: "AllowCloudFrontServicePrincipal",
              Effect: "Allow",
              Principal: { Service: "cloudfront.amazonaws.com" },
              Action: "s3:GetObject",
              Resource: `${bucketArn}/*`,
              Condition: {
                StringEquals: { "AWS:SourceArn": distributionArn },
              },
            },
          ],
        })
    ),
  });

  for (const name of [domain, wwwDomain]) {
    new aws.route53.Record(`dns-${name.replace(/\./g, "-")}`, {
      name,
      type: "A",
      zoneId: zone.zoneId,
      aliases: [
        {
          name: distribution.domainName,
          zoneId: distribution.hostedZoneId,
          evaluateTargetHealth: false,
        },
      ],
    });
  }

  new S3BucketFolder(
    "synced-folder",
    {
      path: "../../apps/homepage/dist",
      bucketName: bucket.bucket,
      acl: "private",
    },
    { dependsOn: [bucketOwnership] }
  );

  return {
    bucketName: bucket.bucket,
    distributionId: distribution.id,
    distributionDomain: distribution.domainName,
  };
}

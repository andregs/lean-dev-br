import * as aws from "@pulumi/aws";
import * as pulumi from "@pulumi/pulumi";

const config = new pulumi.Config();
const domain = config.require("domain");
const wwwDomain = `www.${domain}`;

// ACM certificate — must be in us-east-1 for CloudFront
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

// Route53 hosted zone
const zone = new aws.route53.Zone("zone", {
  name: domain,
});

// DNS validation records for ACM
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

// S3 bucket — private, no static website hosting
const bucket = new aws.s3.BucketV2("bucket", {
  bucket: `lean-dev-br-homepage`,
  forceDestroy: true,
});

new aws.s3.BucketPublicAccessBlock("bucket-public-access-block", {
  bucket: bucket.id,
  blockPublicAcls: true,
  blockPublicPolicy: true,
  ignorePublicAcls: true,
  restrictPublicBuckets: true,
});

// CloudFront Origin Access Control
const oac = new aws.cloudfront.OriginAccessControl("oac", {
  name: "lean-dev-br-homepage-oac",
  originAccessControlOriginType: "s3",
  signingBehavior: "always",
  signingProtocol: "sigv4",
});

// CloudFront distribution
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
  ],
  defaultCacheBehavior: {
    targetOriginId: "s3",
    viewerProtocolPolicy: "redirect-to-https",
    allowedMethods: ["GET", "HEAD"],
    cachedMethods: ["GET", "HEAD"],
    forwardedValues: {
      queryString: false,
      cookies: { forward: "none" },
    },
    compress: true,
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

// S3 bucket policy — allow CloudFront via OAC
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
              StringEquals: {
                "AWS:SourceArn": distributionArn,
              },
            },
          },
        ],
      })
  ),
});

// Route53 alias records → CloudFront
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

export const bucketName = bucket.bucket;
export const distributionId = distribution.id;
export const distributionDomain = distribution.domainName;
export const nameservers = zone.nameServers;

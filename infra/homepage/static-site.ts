import * as aws from '@pulumi/aws';
import * as pulumi from '@pulumi/pulumi';
import { S3BucketFolder } from '@pulumi/synced-folder';
import { cspHeader } from '@lean-dev-br/csp';

// Identical across every static app — only the CSP directive set differs.
const SHARED_SECURITY_HEADERS = {
  contentTypeOptions: { override: true },
  frameOptions: { frameOption: 'DENY' as const, override: true },
  xssProtection: { protection: true, modeBlock: true, override: true },
  referrerPolicy: {
    referrerPolicy: 'strict-origin-when-cross-origin' as const,
    override: true,
  },
  strictTransportSecurity: {
    accessControlMaxAgeSec: 31536000,
    includeSubdomains: true,
    preload: true,
    override: true,
  },
};

export interface StaticSiteArgs {
  // Pulumi logical-name prefix for every resource below — '' for the apex/homepage
  // site (its resources predate this prefix convention), '<app>-' for the rest.
  namePrefix: string;
  bucketName: string;
  oacName: string;
  headersPolicyName: string;
  cspApp?: 'blog' | 'todo' | 'ui-modulith' | 'federation';
  signalUrl?: string;
}

export interface StaticSite {
  bucket: aws.s3.Bucket;
  bucketOwnership: aws.s3.BucketOwnershipControls;
  oac: aws.cloudfront.OriginAccessControl;
  responseHeadersPolicy: aws.cloudfront.ResponseHeadersPolicy;
}

/** Bucket + OAC + response-headers-policy for one static app, ahead of the shared distribution. */
export function createStaticSite({
  namePrefix,
  bucketName,
  oacName,
  headersPolicyName,
  cspApp,
  signalUrl,
}: StaticSiteArgs): StaticSite {
  const bucket = new aws.s3.Bucket(`${namePrefix}bucket`, {
    bucket: bucketName,
    forceDestroy: true,
  });

  new aws.s3.BucketPublicAccessBlock(`${namePrefix}bucket-public-access-block`, {
    bucket: bucket.id,
    blockPublicAcls: true,
    blockPublicPolicy: true,
    ignorePublicAcls: true,
    restrictPublicBuckets: true,
  });

  const bucketOwnership = new aws.s3.BucketOwnershipControls(`${namePrefix}bucket-ownership`, {
    bucket: bucket.id,
    rule: { objectOwnership: 'BucketOwnerPreferred' },
  });

  const oac = new aws.cloudfront.OriginAccessControl(`${namePrefix}oac`, {
    name: oacName,
    originAccessControlOriginType: 's3',
    signingBehavior: 'always',
    signingProtocol: 'sigv4',
  });

  const responseHeadersPolicy = new aws.cloudfront.ResponseHeadersPolicy(
    `${namePrefix}response-headers-policy`,
    {
      name: headersPolicyName,
      securityHeadersConfig: {
        ...SHARED_SECURITY_HEADERS,
        contentSecurityPolicy: {
          contentSecurityPolicy: cspHeader({ mode: 'prod', app: cspApp, signalUrl }),
          override: true,
        },
      },
    },
  );

  return { bucket, bucketOwnership, oac, responseHeadersPolicy };
}

/** Grants the shared CloudFront distribution OAC read access to one app's bucket. */
export function createBucketPolicy(
  namePrefix: string,
  bucket: aws.s3.Bucket,
  distribution: aws.cloudfront.Distribution,
): aws.s3.BucketPolicy {
  return new aws.s3.BucketPolicy(`${namePrefix}bucket-policy`, {
    bucket: bucket.id,
    policy: pulumi.all([bucket.arn, distribution.arn]).apply(([bucketArn, distributionArn]) =>
      JSON.stringify({
        Version: '2012-10-17',
        Statement: [
          {
            Sid: 'AllowCloudFrontServicePrincipal',
            Effect: 'Allow',
            Principal: { Service: 'cloudfront.amazonaws.com' },
            Action: 's3:GetObject',
            Resource: `${bucketArn}/*`,
            Condition: {
              StringEquals: { 'AWS:SourceArn': distributionArn },
            },
          },
        ],
      }),
    ),
  });
}

/** Syncs a local build output directory into one app's bucket. */
export function createSyncedFolder(
  namePrefix: string,
  path: string,
  bucket: aws.s3.Bucket,
  dependsOn: pulumi.Resource[],
): S3BucketFolder {
  return new S3BucketFolder(
    `${namePrefix}synced-folder`,
    { path, bucketName: bucket.bucket, acl: 'private' },
    { dependsOn },
  );
}

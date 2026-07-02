import * as aws from '@pulumi/aws';
import * as pulumi from '@pulumi/pulumi';
import * as fs from 'fs';
import { createBucketPolicy, createStaticSite, createSyncedFolder } from './static-site';

// AWS managed cache policy IDs
const CACHING_DISABLED_POLICY_ID = '4135ea2d-6df8-44a3-9df3-4b5a84be39ad';
const CACHING_OPTIMIZED_POLICY_ID = '658327ea-f89d-4fab-a63d-7e88639e58f6';
// Forwards all viewer headers except Host — required for custom API GW origins
const ALL_VIEWER_EXCEPT_HOST_HEADER_POLICY_ID = 'b689b0a8-53d0-40ab-baf2-68738e2966ac';

interface HostingArgs {
  zone: aws.route53.Zone;
  domain: string;
  executeApiDomain: pulumi.Output<string>;
  relayServiceUrl: string;
}

export function createHosting({ zone, domain, executeApiDomain, relayServiceUrl }: HostingArgs) {
  const wwwDomain = `www.${domain}`;

  const usEast1 = new aws.Provider('us-east-1', { region: 'us-east-1' });

  const cert = new aws.acm.Certificate(
    'cert',
    {
      domainName: domain,
      subjectAlternativeNames: [wwwDomain],
      validationMethod: 'DNS',
    },
    { provider: usEast1 },
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
          new aws.route53.Record(`cert-validation-${opt.domainName.replace(/\./g, '-')}`, {
            name: opt.resourceRecordName,
            type: opt.resourceRecordType,
            zoneId: zone.zoneId,
            records: [opt.resourceRecordValue],
            ttl: 60,
          }),
      );
  });

  const certValidation = new aws.acm.CertificateValidation(
    'cert-validation',
    {
      certificateArn: cert.arn,
      validationRecordFqdns: certValidationRecords.apply((records) => records.map((r) => r.fqdn)),
    },
    { provider: usEast1 },
  );

  // namePrefix '' preserves the apex site's original (pre-multi-app) resource names.
  const apex = createStaticSite({
    namePrefix: '',
    bucketName: 'lean-dev-br-homepage',
    oacName: 'lean-dev-br-homepage-oac',
    headersPolicyName: 'lean-dev-br-security-headers',
  });

  const blog = createStaticSite({
    namePrefix: 'blog-',
    bucketName: 'lean-dev-br-blog',
    oacName: 'lean-dev-br-blog-oac',
    headersPolicyName: 'lean-dev-br-blog-security-headers',
    cspApp: 'blog',
  });

  const todo = createStaticSite({
    namePrefix: 'todo-',
    bucketName: 'lean-dev-br-todo',
    oacName: 'lean-dev-br-todo-oac',
    headersPolicyName: 'lean-dev-br-todo-security-headers',
    cspApp: 'todo',
    signalUrl: relayServiceUrl,
  });

  // worker-src (for the MSW service worker that mocks this demo's API — no real backend).
  const uiModulith = createStaticSite({
    namePrefix: 'ui-modulith-',
    bucketName: 'lean-dev-br-ui-modulith',
    oacName: 'lean-dev-br-ui-modulith-oac',
    headersPolicyName: 'lean-dev-br-ui-modulith-security-headers',
    cspApp: 'ui-modulith',
  });

  // www → apex redirect + SPA fallback for History API routes
  const edgeFn = new aws.cloudfront.Function('edge-fn', {
    runtime: 'cloudfront-js-2.0',
    code: fs.readFileSync('cloudfront-edge.js', 'utf-8'),
    publish: true,
  });

  const distribution = new aws.cloudfront.Distribution('distribution', {
    enabled: true,
    defaultRootObject: 'index.html',
    aliases: [domain, wwwDomain],
    origins: [
      {
        originId: 's3',
        domainName: apex.bucket.bucketRegionalDomainName,
        originAccessControlId: apex.oac.id,
      },
      {
        originId: 'blog-s3',
        domainName: blog.bucket.bucketRegionalDomainName,
        originAccessControlId: blog.oac.id,
      },
      {
        originId: 'todo-s3',
        domainName: todo.bucket.bucketRegionalDomainName,
        originAccessControlId: todo.oac.id,
      },
      {
        originId: 'ui-modulith-s3',
        domainName: uiModulith.bucket.bucketRegionalDomainName,
        originAccessControlId: uiModulith.oac.id,
      },
      {
        originId: 'api',
        domainName: executeApiDomain,
        customOriginConfig: {
          httpPort: 80,
          httpsPort: 443,
          originProtocolPolicy: 'https-only',
          originSslProtocols: ['TLSv1.2'],
        },
      },
    ],
    orderedCacheBehaviors: [
      {
        // _next assets are content-addressed — cache forever, no invalidation needed.
        // Edge fn strips /blog prefix so the path resolves in the dedicated blog bucket.
        pathPattern: '/blog/_next/*',
        targetOriginId: 'blog-s3',
        viewerProtocolPolicy: 'redirect-to-https',
        allowedMethods: ['GET', 'HEAD'],
        cachedMethods: ['GET', 'HEAD'],
        cachePolicyId: CACHING_OPTIMIZED_POLICY_ID,
        responseHeadersPolicyId: blog.responseHeadersPolicy.id,
        compress: true,
        functionAssociations: [
          {
            eventType: 'viewer-request',
            functionArn: edgeFn.arn,
          },
        ],
      },
      {
        // Blog HTML pages — not cached; always fetched fresh from S3. No invalidation needed
        // on deploy. (_next assets use CACHING_OPTIMIZED via the /blog/_next/* behavior above;
        // they're content-addressed so they never go stale.)
        // Edge fn strips /blog prefix + rewrites trailing-slash paths to index.html.
        pathPattern: '/blog/*',
        targetOriginId: 'blog-s3',
        viewerProtocolPolicy: 'redirect-to-https',
        allowedMethods: ['GET', 'HEAD'],
        cachedMethods: ['GET', 'HEAD'],
        cachePolicyId: CACHING_DISABLED_POLICY_ID,
        responseHeadersPolicyId: blog.responseHeadersPolicy.id,
        compress: true,
        functionAssociations: [
          {
            eventType: 'viewer-request',
            functionArn: edgeFn.arn,
          },
        ],
      },
      {
        // Vite assets are content-addressed — cache forever, no invalidation needed.
        // Edge fn strips /todo prefix so the path resolves in the dedicated todo bucket root.
        pathPattern: '/todo/assets/*',
        targetOriginId: 'todo-s3',
        viewerProtocolPolicy: 'redirect-to-https',
        allowedMethods: ['GET', 'HEAD'],
        cachedMethods: ['GET', 'HEAD'],
        cachePolicyId: CACHING_OPTIMIZED_POLICY_ID,
        responseHeadersPolicyId: todo.responseHeadersPolicy.id,
        compress: true,
        functionAssociations: [
          {
            eventType: 'viewer-request',
            functionArn: edgeFn.arn,
          },
        ],
      },
      {
        // Todo HTML — not cached; always fetched fresh from S3.
        // Edge fn strips /todo prefix + rewrites extensionless paths to index.html (Vite SPA).
        pathPattern: '/todo/*',
        targetOriginId: 'todo-s3',
        viewerProtocolPolicy: 'redirect-to-https',
        allowedMethods: ['GET', 'HEAD'],
        cachedMethods: ['GET', 'HEAD'],
        cachePolicyId: CACHING_DISABLED_POLICY_ID,
        responseHeadersPolicyId: todo.responseHeadersPolicy.id,
        compress: true,
        functionAssociations: [
          {
            eventType: 'viewer-request',
            functionArn: edgeFn.arn,
          },
        ],
      },
      {
        // Vite assets are content-addressed — cache forever, no invalidation needed.
        // Edge fn strips /labs/ui-modulith prefix so the path resolves in the bucket root.
        pathPattern: '/labs/ui-modulith/assets/*',
        targetOriginId: 'ui-modulith-s3',
        viewerProtocolPolicy: 'redirect-to-https',
        allowedMethods: ['GET', 'HEAD'],
        cachedMethods: ['GET', 'HEAD'],
        cachePolicyId: CACHING_OPTIMIZED_POLICY_ID,
        responseHeadersPolicyId: uiModulith.responseHeadersPolicy.id,
        compress: true,
        functionAssociations: [
          {
            eventType: 'viewer-request',
            functionArn: edgeFn.arn,
          },
        ],
      },
      {
        // ui-modulith HTML/mockServiceWorker.js — not cached; always fetched fresh from S3.
        // Edge fn strips /labs/ui-modulith prefix + rewrites extensionless paths to index.html
        // (React Router SPA, same fallback as /todo/*).
        pathPattern: '/labs/ui-modulith/*',
        targetOriginId: 'ui-modulith-s3',
        viewerProtocolPolicy: 'redirect-to-https',
        allowedMethods: ['GET', 'HEAD'],
        cachedMethods: ['GET', 'HEAD'],
        cachePolicyId: CACHING_DISABLED_POLICY_ID,
        responseHeadersPolicyId: uiModulith.responseHeadersPolicy.id,
        compress: true,
        functionAssociations: [
          {
            eventType: 'viewer-request',
            functionArn: edgeFn.arn,
          },
        ],
      },
      {
        pathPattern: '/api/*',
        targetOriginId: 'api',
        viewerProtocolPolicy: 'https-only',
        allowedMethods: ['DELETE', 'GET', 'HEAD', 'OPTIONS', 'PATCH', 'POST', 'PUT'],
        cachedMethods: ['GET', 'HEAD'],
        cachePolicyId: CACHING_DISABLED_POLICY_ID,
        originRequestPolicyId: ALL_VIEWER_EXCEPT_HOST_HEADER_POLICY_ID,
        compress: true,
      },
      {
        pathPattern: '/assets/*',
        targetOriginId: 's3',
        viewerProtocolPolicy: 'redirect-to-https',
        allowedMethods: ['GET', 'HEAD'],
        cachedMethods: ['GET', 'HEAD'],
        cachePolicyId: CACHING_OPTIMIZED_POLICY_ID,
        responseHeadersPolicyId: apex.responseHeadersPolicy.id,
        compress: true,
      },
    ],
    defaultCacheBehavior: {
      targetOriginId: 's3',
      viewerProtocolPolicy: 'redirect-to-https',
      allowedMethods: ['GET', 'HEAD'],
      cachedMethods: ['GET', 'HEAD'],
      cachePolicyId: CACHING_DISABLED_POLICY_ID,
      responseHeadersPolicyId: apex.responseHeadersPolicy.id,
      compress: true,
      functionAssociations: [
        {
          eventType: 'viewer-request',
          functionArn: edgeFn.arn,
        },
      ],
    },
    priceClass: 'PriceClass_100',
    viewerCertificate: {
      acmCertificateArn: certValidation.certificateArn,
      sslSupportMethod: 'sni-only',
      minimumProtocolVersion: 'TLSv1.2_2021',
    },
    restrictions: {
      geoRestriction: { restrictionType: 'none' },
    },
  });

  createBucketPolicy('', apex.bucket, distribution);
  createBucketPolicy('blog-', blog.bucket, distribution);
  createBucketPolicy('todo-', todo.bucket, distribution);
  createBucketPolicy('ui-modulith-', uiModulith.bucket, distribution);

  for (const name of [domain, wwwDomain]) {
    new aws.route53.Record(`dns-${name.replace(/\./g, '-')}`, {
      name,
      type: 'A',
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

  createSyncedFolder('', '../../apps/homepage/dist', apex.bucket, [apex.bucketOwnership]);
  createSyncedFolder('blog-', '../../apps/blog/out', blog.bucket, [blog.bucketOwnership]);
  createSyncedFolder('todo-', '../../apps/todo/dist', todo.bucket, [todo.bucketOwnership]);
  createSyncedFolder(
    'ui-modulith-',
    // Vite's outDir here is workspace-level dist/, unlike the other apps' in-app dist/.
    '../../dist/apps/ui-modulith',
    uiModulith.bucket,
    [uiModulith.bucketOwnership],
  );

  return {
    bucketName: apex.bucket.bucket,
    distributionId: distribution.id,
    distributionDomain: distribution.domainName,
  };
}

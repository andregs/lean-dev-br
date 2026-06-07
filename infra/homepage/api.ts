import * as aws from '@pulumi/aws';
import * as pulumi from '@pulumi/pulumi';

interface ApiArgs {
  notifyEmail: pulumi.Output<string>;
  recaptchaSecret: pulumi.Output<string>;
  domain: string;
  cspReportRateLimit: number;
  cspReportBurstLimit: number;
  cspReportMaxBytes: number;
}

export function createApi({
  notifyEmail,
  recaptchaSecret,
  domain,
  cspReportRateLimit,
  cspReportBurstLimit,
  cspReportMaxBytes,
}: ApiArgs) {
  const lambdaRole = new aws.iam.Role('lambda-role', {
    assumeRolePolicy: JSON.stringify({
      Version: '2012-10-17',
      Statement: [
        {
          Effect: 'Allow',
          Principal: { Service: 'lambda.amazonaws.com' },
          Action: 'sts:AssumeRole',
        },
      ],
    }),
  });

  // SES checks IAM authorization against both the FROM identity and the TO identity
  // when the TO address is a verified SES identity in the same account.
  // Scope to all identities in this account rather than enumerate specific addresses.
  const callerIdentity = aws.getCallerIdentityOutput();
  const sesIdentitiesArn = pulumi.interpolate`arn:aws:ses:us-east-1:${callerIdentity.accountId}:identity/*`;

  new aws.iam.RolePolicy('lambda-policy', {
    role: lambdaRole.id,
    policy: sesIdentitiesArn.apply((arn) =>
      JSON.stringify({
        Version: '2012-10-17',
        Statement: [
          {
            Effect: 'Allow',
            Action: 'ses:SendEmail',
            Resource: arn,
          },
          {
            Effect: 'Allow',
            Action: ['logs:CreateLogGroup', 'logs:CreateLogStream', 'logs:PutLogEvents'],
            Resource: 'arn:aws:logs:*:*:*',
          },
        ],
      }),
    ),
  });

  const fn = new aws.lambda.Function('contact-api', {
    runtime: 'nodejs22.x',
    handler: 'handler.handler',
    code: new pulumi.asset.AssetArchive({
      'handler.cjs': new pulumi.asset.FileAsset('../../apps/contact-api/dist/handler.cjs'),
    }),
    role: lambdaRole.arn,
    timeout: 10,
    environment: {
      variables: {
        NOTIFY_EMAIL: notifyEmail,
        FROM_EMAIL: `do-not-reply@${domain}`,
        RECAPTCHA_SECRET: recaptchaSecret,
        RECAPTCHA_VERIFY_URL: 'https://www.google.com/recaptcha/api/siteverify',
        RECAPTCHA_ACTION: 'contact',
        SUBJECT_PREFIX: '[Contact]',
        MIN_SCORE: '0.5',
        CSP_REPORT_MAX_BYTES: String(cspReportMaxBytes),
      },
    },
  });

  const api = new aws.apigatewayv2.Api('contact-api-gw', {
    protocolType: 'HTTP',
    name: 'contact-api',
  });

  const integration = new aws.apigatewayv2.Integration('contact-api-integration', {
    apiId: api.id,
    integrationType: 'AWS_PROXY',
    integrationUri: fn.arn,
    payloadFormatVersion: '2.0',
  });

  new aws.apigatewayv2.Route('contact-api-route', {
    apiId: api.id,
    routeKey: 'POST /api/contact',
    target: pulumi.interpolate`integrations/${integration.id}`,
  });

  const cspReportRoute = new aws.apigatewayv2.Route('csp-report-route', {
    apiId: api.id,
    routeKey: 'POST /api/csp-report',
    target: pulumi.interpolate`integrations/${integration.id}`,
  });

  new aws.apigatewayv2.Stage(
    'contact-api-stage',
    {
      apiId: api.id,
      name: '$default',
      autoDeploy: true,
      routeSettings: [
        {
          routeKey: 'POST /api/csp-report',
          throttlingRateLimit: cspReportRateLimit,
          throttlingBurstLimit: cspReportBurstLimit,
        },
      ],
    },
    { dependsOn: [cspReportRoute] },
  );

  new aws.lambda.Permission('contact-api-invoke-permission', {
    action: 'lambda:InvokeFunction',
    function: fn.name,
    principal: 'apigateway.amazonaws.com',
    sourceArn: pulumi.interpolate`${api.executionArn}/*/*`,
  });

  // Bare domain used as CloudFront custom origin (no https:// prefix)
  const executeApiDomain = pulumi.interpolate`${api.id}.execute-api.us-east-1.amazonaws.com`;

  return {
    apiEndpoint: pulumi.interpolate`https://${executeApiDomain}`,
    executeApiDomain,
  };
}

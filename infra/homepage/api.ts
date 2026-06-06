import * as aws from "@pulumi/aws";
import * as pulumi from "@pulumi/pulumi";

interface ApiArgs {
  sesIdentityArn: pulumi.Output<string>;
  notifyEmail: pulumi.Output<string>;
  recaptchaSecret: pulumi.Output<string>;
  domain: string;
}

export function createApi({ sesIdentityArn, notifyEmail, recaptchaSecret, domain }: ApiArgs) {
  const lambdaRole = new aws.iam.Role("lambda-role", {
    assumeRolePolicy: JSON.stringify({
      Version: "2012-10-17",
      Statement: [
        {
          Effect: "Allow",
          Principal: { Service: "lambda.amazonaws.com" },
          Action: "sts:AssumeRole",
        },
      ],
    }),
  });

  new aws.iam.RolePolicy("lambda-policy", {
    role: lambdaRole.id,
    policy: sesIdentityArn.apply((arn) =>
      JSON.stringify({
        Version: "2012-10-17",
        Statement: [
          {
            Effect: "Allow",
            Action: "ses:SendEmail",
            Resource: arn,
          },
          {
            Effect: "Allow",
            Action: [
              "logs:CreateLogGroup",
              "logs:CreateLogStream",
              "logs:PutLogEvents",
            ],
            Resource: "arn:aws:logs:*:*:*",
          },
        ],
      })
    ),
  });

  const fn = new aws.lambda.Function("contact-api", {
    runtime: "nodejs22.x",
    handler: "handler.handler",
    code: new pulumi.asset.AssetArchive({
      "handler.js": new pulumi.asset.FileAsset(
        "../../apps/contact-api/dist/handler.js"
      ),
    }),
    role: lambdaRole.arn,
    timeout: 10,
    environment: {
      variables: {
        NOTIFY_EMAIL: notifyEmail,
        FROM_EMAIL: `do-not-reply@${domain}`,
        RECAPTCHA_SECRET: recaptchaSecret,
        RECAPTCHA_VERIFY_URL:
          "https://www.google.com/recaptcha/api/siteverify",
        RECAPTCHA_ACTION: "contact",
        SUBJECT_PREFIX: "[Contact]",
        MIN_SCORE: "0.5",
      },
    },
  });

  const api = new aws.apigatewayv2.Api("contact-api-gw", {
    protocolType: "HTTP",
    name: "contact-api",
  });

  const integration = new aws.apigatewayv2.Integration(
    "contact-api-integration",
    {
      apiId: api.id,
      integrationType: "AWS_PROXY",
      integrationUri: fn.arn,
      payloadFormatVersion: "2.0",
    }
  );

  new aws.apigatewayv2.Route("contact-api-route", {
    apiId: api.id,
    routeKey: "POST /api/contact",
    target: pulumi.interpolate`integrations/${integration.id}`,
  });

  new aws.apigatewayv2.Stage("contact-api-stage", {
    apiId: api.id,
    name: "$default",
    autoDeploy: true,
  });

  new aws.lambda.Permission("contact-api-invoke-permission", {
    action: "lambda:InvokeFunction",
    function: fn.name,
    principal: "apigateway.amazonaws.com",
    sourceArn: pulumi.interpolate`${api.executionArn}/*/*`,
  });

  // Bare domain used as CloudFront custom origin (no https:// prefix)
  const executeApiDomain = pulumi.interpolate`${api.id}.execute-api.us-east-1.amazonaws.com`;

  return {
    apiEndpoint: pulumi.interpolate`https://${executeApiDomain}`,
    executeApiDomain,
  };
}

import * as aws from '@pulumi/aws';

interface ObservabilityArgs {
  domain: string;
}

export function createObservability({ domain }: ObservabilityArgs) {
  const identityPool = new aws.cognito.IdentityPool('rum-identity-pool', {
    identityPoolName: 'lean-dev-br-rum',
    allowUnauthenticatedIdentities: true,
  });

  // Trust policy scoped to this identity pool's unauthenticated identities only
  const rumRole = new aws.iam.Role('rum-unauthenticated-role', {
    assumeRolePolicy: identityPool.id.apply((poolId) =>
      JSON.stringify({
        Version: '2012-10-17',
        Statement: [
          {
            Effect: 'Allow',
            Principal: { Federated: 'cognito-identity.amazonaws.com' },
            Action: 'sts:AssumeRoleWithWebIdentity',
            Condition: {
              StringEquals: {
                'cognito-identity.amazonaws.com:aud': poolId,
              },
              'ForAnyValue:StringLike': {
                'cognito-identity.amazonaws.com:amr': 'unauthenticated',
              },
            },
          },
        ],
      }),
    ),
  });

  const appMonitor = new aws.rum.AppMonitor('rum-app-monitor', {
    name: 'lean-dev-br',
    domain: domain,
    cwLogEnabled: true,
  });

  new aws.iam.RolePolicy('rum-role-policy', {
    role: rumRole.id,
    policy: appMonitor.arn.apply((arn) =>
      JSON.stringify({
        Version: '2012-10-17',
        Statement: [
          {
            Effect: 'Allow',
            Action: 'rum:PutRumEvents',
            Resource: arn,
          },
        ],
      }),
    ),
  });

  new aws.cognito.IdentityPoolRoleAttachment('rum-identity-pool-roles', {
    identityPoolId: identityPool.id,
    roles: { unauthenticated: rumRole.arn },
  });

  return {
    identityPoolId: identityPool.id,
    appMonitorId: appMonitor.appMonitorId,
  };
}

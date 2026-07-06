import * as aws from '@pulumi/aws';
import * as gcp from '@pulumi/gcp';
import * as pulumi from '@pulumi/pulumi';
import * as grafana from '@pulumiverse/grafana';

const config = new pulumi.Config();
const grafanaUrl = config.require('grafanaUrl');
const grafanaAuth = config.requireSecret('grafanaAuth');

const gcpConfig = new pulumi.Config('gcp');
const gcpProject = gcpConfig.require('project');

const awsConfig = new pulumi.Config('aws');
const awsRegion = awsConfig.require('region');

const grafanaProvider = new grafana.Provider('grafana', {
  url: grafanaUrl,
  auth: grafanaAuth,
});

// ── AWS: read-only IAM user for the CloudWatch datasource ──────────────────
const cloudwatchReader = new aws.iam.User('grafana-cloudwatch-reader', {
  name: 'grafana-cloudwatch-reader',
});

new aws.iam.UserPolicyAttachment('grafana-cloudwatch-reader-policy', {
  user: cloudwatchReader.name,
  // AWS-managed, read-only — no need to hand-roll a policy JSON.
  policyArn: 'arn:aws:iam::aws:policy/CloudWatchReadOnlyAccess',
});

const cloudwatchAccessKey = new aws.iam.AccessKey('grafana-cloudwatch-reader-key', {
  user: cloudwatchReader.name,
});

new grafana.oss.DataSource(
  'cloudwatch',
  {
    type: 'cloudwatch',
    name: 'CloudWatch',
    jsonDataEncoded: pulumi.jsonStringify({
      defaultRegion: awsRegion,
      authType: 'keys',
    }),
    secureJsonDataEncoded: pulumi.jsonStringify({
      accessKey: cloudwatchAccessKey.id,
      secretKey: cloudwatchAccessKey.secret,
    }),
  },
  { provider: grafanaProvider },
);

// ── GCP: read-only service account for the Cloud Monitoring datasource ─────
const monitoringReader = new gcp.serviceaccount.Account('grafana-monitoring-reader', {
  project: gcpProject,
  accountId: 'grafana-monitoring-reader',
  displayName: 'Grafana Cloud Monitoring datasource',
});

new gcp.projects.IAMMember('grafana-monitoring-reader-role', {
  project: gcpProject,
  role: 'roles/monitoring.viewer',
  member: pulumi.interpolate`serviceAccount:${monitoringReader.email}`,
});

const monitoringReaderKey = new gcp.serviceaccount.Key('grafana-monitoring-reader-key', {
  serviceAccountId: monitoringReader.name,
});

// Pulumi's privateKey output is the base64-encoded JSON key file; only the
// private_key field is needed here, the rest is already known above.
const monitoringReaderPrivateKey = monitoringReaderKey.privateKey.apply(
  (b64) =>
    (JSON.parse(Buffer.from(b64, 'base64').toString('utf8')) as { private_key: string })
      .private_key,
);

new grafana.oss.DataSource(
  'gcp-monitoring',
  {
    type: 'stackdriver',
    name: 'GCP Cloud Monitoring',
    jsonDataEncoded: pulumi.jsonStringify({
      authenticationType: 'jwt',
      defaultProject: gcpProject,
      clientEmail: monitoringReader.email,
      tokenUri: 'https://oauth2.googleapis.com/token',
      universeDomain: 'googleapis.com',
    }),
    secureJsonDataEncoded: monitoringReaderPrivateKey.apply((privateKey) =>
      JSON.stringify({ privateKey }),
    ),
  },
  { provider: grafanaProvider },
);

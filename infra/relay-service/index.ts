import * as gcp from '@pulumi/gcp';
import * as pulumi from '@pulumi/pulumi';

const gcpConfig = new pulumi.Config('gcp');
const gcpProject = gcpConfig.require('project');
const gcpRegion = gcpConfig.get('region') ?? 'us-central1';

const config = new pulumi.Config();
const imageTag = config.get('imageTag');
const pruneToken = config.requireSecret('pruneToken');
const alertEmail = config.requireSecret('alertEmail');

// Grafana OTLP gateway for traces. Endpoint isn't a secret; the Authorization
// header value is (it embeds the API token).
const otelOtlpEndpoint = config.require('otelOtlpEndpoint');
const otelOtlpAuthorization = config.requireSecret('otelOtlpAuthorization');

// Artifact Registry repository — created on first deploy; used by docker-push target.
const repo = new gcp.artifactregistry.Repository('relay-service-repo', {
  project: gcpProject,
  location: gcpRegion,
  repositoryId: 'relay-service',
  format: 'DOCKER',
});

// Backs FirestoreRoomStore (prod profile). Location is permanent once created.
const firestore = new gcp.firestore.Database('relay-firestore', {
  project: gcpProject,
  name: '(default)',
  locationId: gcpRegion,
  type: 'FIRESTORE_NATIVE',
  deletionPolicy: 'DELETE',
});

// Runtime identity for Cloud Run — scoped to Firestore only, replaces the default compute SA.
const runtimeSa = new gcp.serviceaccount.Account('relay-runtime', {
  project: gcpProject,
  accountId: 'relay-runtime',
  displayName: 'relay-service Cloud Run runtime',
});

const runtimeSaDatastoreUser = new gcp.projects.IAMMember('relay-runtime-datastore-user', {
  project: gcpProject,
  role: 'roles/datastore.user',
  member: pulumi.interpolate`serviceAccount:${runtimeSa.email}`,
});

// If imageTag is not yet set, use Google's public placeholder so the service can be
// created on first deploy. Replace with the real image after the first docker-push.
const PLACEHOLDER = 'us-docker.pkg.dev/cloudrun/container/hello:latest';
const image = imageTag
  ? pulumi.interpolate`${gcpRegion}-docker.pkg.dev/${gcpProject}/relay-service/relay-service:${imageTag}`
  : PLACEHOLDER;

const service = new gcp.cloudrunv2.Service(
  'relay-service',
  {
    project: gcpProject,
    location: gcpRegion,
    name: 'relay-service',
    template: {
      serviceAccount: runtimeSa.email,
      scaling: {
        minInstanceCount: 0,
        maxInstanceCount: 1,
      },
      containers: [
        {
          image,
          // Cloud Run v2 defaults to port 8080; Spring Boot also defaults to 8080 — no override needed.
          envs: [
            { name: 'SPRING_PROFILES_ACTIVE', value: 'prod' },
            { name: 'RELAY_PRUNETOKEN', value: pruneToken },
            {
              name: 'MANAGEMENT_OPENTELEMETRY_TRACING_EXPORT_OTLP_ENDPOINT',
              value: otelOtlpEndpoint,
            },
            { name: 'OTEL_OTLP_AUTHORIZATION', value: otelOtlpAuthorization },
          ],
          resources: {
            cpuIdle: true,
            limits: { memory: '256Mi', cpu: '1000m' },
          },
        },
      ],
    },
  },
  { dependsOn: [repo, firestore, runtimeSaDatastoreUser] },
);

// Allow unauthenticated invocations — the todo client calls the relay directly.
new gcp.cloudrunv2.ServiceIamMember('relay-service-invoker', {
  project: gcpProject,
  location: gcpRegion,
  name: service.name,
  role: 'roles/run.invoker',
  member: 'allUsers',
});

// Cloud Run scale-to-zero means in-process @Scheduled cleanup never fires reliably —
// Cloud Scheduler wakes the service daily to call the prune endpoint instead.
new gcp.cloudscheduler.Job(
  'relay-prune-job',
  {
    project: gcpProject,
    region: gcpRegion,
    name: 'relay-service-prune',
    description: 'Daily prune of idle Yjs rooms older than relay.room-ttl',
    schedule: '0 3 * * *',
    timeZone: 'Etc/UTC',
    httpTarget: {
      httpMethod: 'POST',
      uri: pulumi.interpolate`${service.uri}/internal/prune`,
      headers: { 'X-Prune-Token': pruneToken },
    },
  },
  { dependsOn: [service] },
);

const alertChannel = new gcp.monitoring.NotificationChannel('relay-quota-alert-channel', {
  project: gcpProject,
  displayName: 'relay-service quota alerts',
  type: 'email',
  labels: { email_address: alertEmail },
});

// Firestore's free tier resets daily (50k reads / 20k writes) — alert at 80% so there's
// time to react before the next reset bills usage.
new gcp.monitoring.AlertPolicy('relay-firestore-read-quota', {
  project: gcpProject,
  displayName: 'Firestore daily reads nearing free-tier quota',
  combiner: 'OR',
  conditions: [
    {
      displayName: 'Daily document reads > 40k (80% of 50k free tier)',
      conditionThreshold: {
        filter:
          'metric.type="firestore.googleapis.com/document/read_count" AND resource.type="firestore_instance"',
        duration: '0s',
        comparison: 'COMPARISON_GT',
        thresholdValue: 40000,
        aggregations: [
          {
            alignmentPeriod: '86400s',
            perSeriesAligner: 'ALIGN_SUM',
            crossSeriesReducer: 'REDUCE_SUM',
          },
        ],
      },
    },
  ],
  notificationChannels: [alertChannel.id],
});

new gcp.monitoring.AlertPolicy('relay-firestore-write-quota', {
  project: gcpProject,
  displayName: 'Firestore daily writes nearing free-tier quota',
  combiner: 'OR',
  conditions: [
    {
      displayName: 'Daily document writes > 16k (80% of 20k free tier)',
      conditionThreshold: {
        filter:
          'metric.type="firestore.googleapis.com/document/write_count" AND resource.type="firestore_instance"',
        duration: '0s',
        comparison: 'COMPARISON_GT',
        thresholdValue: 16000,
        aggregations: [
          {
            alignmentPeriod: '86400s',
            perSeriesAligner: 'ALIGN_SUM',
            crossSeriesReducer: 'REDUCE_SUM',
          },
        ],
      },
    },
  ],
  notificationChannels: [alertChannel.id],
});

export const serviceUrl = service.uri;
export const repoUrl = pulumi.interpolate`${gcpRegion}-docker.pkg.dev/${gcpProject}/relay-service`;

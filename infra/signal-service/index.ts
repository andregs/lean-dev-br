import * as gcp from '@pulumi/gcp';
import * as pulumi from '@pulumi/pulumi';

const gcpConfig = new pulumi.Config('gcp');
const gcpProject = gcpConfig.require('project');
const gcpRegion = gcpConfig.get('region') ?? 'us-central1';

const config = new pulumi.Config();
const imageTag = config.get('imageTag');

// Artifact Registry repository — created on first deploy; used by docker-push target.
const repo = new gcp.artifactregistry.Repository('signal-service-repo', {
  project: gcpProject,
  location: gcpRegion,
  repositoryId: 'signal-service',
  format: 'DOCKER',
});

// If imageTag is not yet set, use Google's public placeholder so the service can be
// created on first deploy. Replace with the real image after the first docker-push.
const PLACEHOLDER = 'us-docker.pkg.dev/cloudrun/container/hello:latest';
const image = imageTag
  ? pulumi.interpolate`${gcpRegion}-docker.pkg.dev/${gcpProject}/signal-service/signal-service:${imageTag}`
  : PLACEHOLDER;

const service = new gcp.cloudrunv2.Service(
  'signal-service',
  {
    project: gcpProject,
    location: gcpRegion,
    name: 'signal-service',
    template: {
      scaling: {
        minInstanceCount: 0,
        maxInstanceCount: 1,
      },
      containers: [
        {
          image,
          // Cloud Run v2 defaults to port 8080; Spring Boot also defaults to 8080 — no override needed.
          resources: {
            cpuIdle: true,
            limits: { memory: '256Mi', cpu: '1000m' },
          },
        },
      ],
    },
  },
  { dependsOn: [repo] },
);

// Allow unauthenticated invocations — the todo client calls the relay directly.
new gcp.cloudrunv2.ServiceIamMember('signal-service-invoker', {
  project: gcpProject,
  location: gcpRegion,
  name: service.name,
  role: 'roles/run.invoker',
  member: 'allUsers',
});

export const serviceUrl = service.uri;
export const repoUrl = pulumi.interpolate`${gcpRegion}-docker.pkg.dev/${gcpProject}/signal-service`;

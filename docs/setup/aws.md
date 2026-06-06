# AWS Account Setup

## 1. Create an AWS account

Go to https://aws.amazon.com and create an account if you don't have one.

## 2. Create an IAM user for deployments

We use a dedicated IAM user (`lean-dev-deploy`) with programmatic access instead of root credentials.

In the AWS Console:

1. Go to **IAM → Users → Create user**
2. Username: `lean-dev-deploy`
3. Attach policy: **AdministratorAccess** (can be scoped down later once infra is stable)
4. Go to the user → **Security credentials → Create access key**
5. Use case: **Command Line Interface (CLI)**
6. Note the **Access key ID** and **Secret access key** — these are shown only once

## 3. Store credentials with pass-cli

We use [Proton Pass CLI](https://proton.me/pass/pass-cli) to manage local secrets. Store the AWS keys as a login item with title: `iam-lean-dev-deploy`

## 4. Configure local AWS credentials

```zsh
aws configure
# AWS Access Key ID: <access key from step 2>
# AWS Secret Access Key: <secret from step 2>
# Default region name: us-east-1
# Default output format: json
```

Verify:

```zsh
aws sts get-caller-identity
```

Expected output: JSON with your account ID and `lean-dev-deploy` ARN.

## Region

All resources use `us-east-1`. ACM certificates for CloudFront must be in `us-east-1`.

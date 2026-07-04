# Pulumi Setup

We use [Pulumi](https://www.pulumi.com/) for infrastructure as code, with Pulumi Cloud as the state backend (free tier).

## 1. Create a Pulumi Cloud account

Go to https://app.pulumi.com and sign up.

## 2. Generate an access token

In Pulumi Cloud → **Settings → Access Tokens → Create token**

Note the token — it is shown only once.

## 3. Store token with pass-cli

We use [Proton Pass CLI](https://proton.me/pass/pass-cli) to manage local secrets:

```zsh
pass-cli item view --vault-name lean-dev-br \
  --item-title=pulumi-access-token
```

## 4. Log in locally

```zsh
pulumi login
```

This opens a browser. Alternatively, use the token directly:

```zsh
PULUMI_ACCESS_TOKEN=$(pass-cli item view --vault-name lean-dev-br --item-title=pulumi-access-token --field=Secret) \
  pulumi login
```

## 5. Store token as GitHub Actions secret

In the GitHub repository → **Settings → Secrets and variables → Actions → New repository secret**:

| Secret name           | Value             |
| --------------------- | ----------------- |
| `PULUMI_ACCESS_TOKEN` | Token from step 2 |

See [aws.md](aws.md) for the AWS secrets also required by CI.

## 6. Set stack secrets

Two secrets must be set before the first `pulumi up`. They are encrypted and stored in Pulumi Cloud state — never commit plaintext values.

```zsh
cd infra/homepage
pulumi config set --secret notifyEmail <your-email>
pulumi config set --secret recaptchaSecret <recaptcha-secret-key>
```

See [recaptcha.md](recaptcha.md) for the reCAPTCHA secret key and [ses.md](ses.md) for SES sandbox restrictions that apply after the first deploy.

## 7. Deploy infrastructure and content

Stack config (`Pulumi.prod.yaml`) is committed to the repo — no manual `stack init` needed.

```zsh
cd infra/homepage
pnpm install
pulumi preview   # dry-run, no changes
pulumi up
```

**Note:** On first run, `pulumi up` will wait at ACM certificate validation until DNS is delegated to Route53. See [dns.md](dns.md).

New outputs in this iteration:

```zsh
pulumi stack output apiEndpoint        # API Gateway invoke URL
pulumi stack output sesDomainIdentity  # lean.dev.br
```

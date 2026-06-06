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

## 5. Deploy infrastructure

Stack config (`Pulumi.prod.yaml`) is committed to the repo — no manual `stack init` needed.

```zsh
cd infra/homepage
pnpm install
pulumi preview   # dry-run, no changes
pulumi up        # provision resources
```

**Note:** On first run, `pulumi up` will wait at ACM certificate validation until DNS is delegated to Route53. The Route53 nameservers are output after the zone is created — use them to update your registrar.

After `pulumi up` completes:

```zsh
pulumi stack output               # all outputs
pulumi stack output bucketName
pulumi stack output distributionId
pulumi stack output nameservers   # Route53 NS records
```

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

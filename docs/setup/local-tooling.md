# Local Tooling Setup

All tool versions are managed via [asdf](https://asdf-vm.com/). The required versions are pinned in `.tool-versions`.

## Prerequisites

- [asdf](https://asdf-vm.com/guide/getting-started.html) — runtime version manager
- [Proton Pass CLI](https://proton.me/pass/pass-cli) (`pass-cli`) — local secrets manager and SSH agent

## Install tool versions

```zsh
# Add required plugins (one-time per machine)
asdf plugin add nodejs
asdf plugin add pnpm
asdf plugin add pulumi
asdf plugin add awscli

# Install all pinned versions
asdf install

# Install Node dependencies
pnpm install
```

## Verify

```zsh
node --version    # matches .tool-versions
pnpm --version
pulumi version
aws --version
```

## Configure credentials

See the individual setup guides:

- [AWS credentials](aws.md)
- [Pulumi Cloud login](pulumi.md)

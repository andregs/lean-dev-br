# lean.dev.br

Personal portfolio and demo projects — full-stack across multiple technologies and cloud platforms.

**Domain:** [lean.dev.br](https://lean.dev.br)

## Stack

- **Frontend:** Plain HTML5 / CSS3 / JS (Iteration 1)
- **Infra:** AWS S3 + CloudFront + Route53, managed with [Pulumi](https://www.pulumi.com/)
- **Monorepo:** [Nx](https://nx.dev/)
- **CI/CD:** GitHub Actions
- **Version manager:** [asdf](https://asdf-vm.com/)
- **Package manager:** pnpm

## Local Setup

See [docs/setup/local-tooling.md](docs/setup/local-tooling.md) for full instructions.

Quick start (assumes asdf and plugins already installed):

```bash
asdf install      # install pinned tool versions
pnpm install      # install Node dependencies
```

You will also need:
- AWS credentials configured — see [docs/setup/aws.md](docs/setup/aws.md)
- Pulumi Cloud account and login — see [docs/setup/pulumi.md](docs/setup/pulumi.md)

## Project Structure

```
apps/
  homepage/       # static HTML site (lean.dev.br)
infra/
  homepage/       # Pulumi IaC — S3, CloudFront, Route53
docs/
  setup/          # setup guides for contributors
```

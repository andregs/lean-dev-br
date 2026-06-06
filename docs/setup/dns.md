# DNS Delegation Setup

`lean.dev.br` is registered at [Registro.br](https://registro.br) but DNS is managed by Route53 (created by Pulumi). This is a one-time step.

## Get Route53 nameservers

After running `pulumi up` for the first time, retrieve the nameservers:

```zsh
cd infra/homepage
pulumi stack output nameservers --stack prod
```

Example output:

```
[
  "ns-349.awsdns-43.com",
  "ns-1467.awsdns-55.org",
  "ns-659.awsdns-18.net",
  "ns-1922.awsdns-48.co.uk"
]
```

## Update nameservers at Registro.br

1. Log into [registro.br](https://registro.br) → **Domínios** → `lean.dev.br`
2. Click **Alterar Servidores DNS**
3. Replace all existing NS entries with the 4 values from the stack output
4. Click **Salvar Alterações**

Registro.br publishes DNS changes every 5 minutes, but the full transition period is up to 24 hours.

## Verify delegation

```zsh
dig +trace NS lean.dev.br
```

When `.br.` TLD resolves to the `awsdns` nameservers, delegation is complete. Your local resolver may cache the old NS records for up to 1 hour — `+trace` bypasses that cache and queries authoritative servers directly.

## Resume Pulumi deploy after delegation

On first run, `pulumi up` pauses at ACM certificate validation until Route53 is authoritative. Once `dig +trace` confirms delegation, re-run:

```zsh
pulumi up --stack prod
```

Pulumi is idempotent — it picks up where it left off and completes cert validation.

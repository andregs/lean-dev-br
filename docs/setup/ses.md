# SES Setup

AWS SES handles outbound email for the contact form. All DNS records (DKIM, MAIL FROM, DMARC) are provisioned automatically by Pulumi. The manual steps are limited to sandbox restrictions and production access.

## What Pulumi provisions

| Resource                               | Purpose                                                              |
| -------------------------------------- | -------------------------------------------------------------------- |
| `SES DomainIdentity` for `lean.dev.br` | Proves domain ownership to SES                                       |
| 3 DKIM CNAME records in Route53        | Enables DKIM signing — proves mail comes from you                    |
| Custom MAIL FROM: `mail.lean.dev.br`   | Aligns envelope sender with signing domain (improves deliverability) |
| MX record for `mail.lean.dev.br`       | Routes SES bounce/complaint feedback                                 |
| SPF TXT record for `mail.lean.dev.br`  | Authorises SES to send on behalf of `mail.lean.dev.br`               |
| DMARC TXT record `_dmarc.lean.dev.br`  | Policy: `p=none` (monitoring mode — see below)                       |

## 1. Run `pulumi up` first

The DKIM CNAME records must propagate before SES marks the domain as verified. After `pulumi up`:

```zsh
aws ses get-identity-dkim-attributes --identities lean.dev.br
```

Wait until `"DkimVerificationStatus": "Success"`. This can take a few minutes up to 72 hours, but is usually fast once the CNAMEs are in Route53.

## 2. Verify the notify email (sandbox only)

SES starts in **sandbox mode** — it can only send to addresses that have been individually verified.

Verify André's notify address so the Lambda can send to it:

```zsh
aws ses verify-email-identity --email-address <your-notify-email>
```

Check the inbox for the verification link and click it.

**This step is only needed while in sandbox mode.** Once production access is granted (step 3), SES can send to any address.

## 3. Request production access

While in sandbox, the visitor ACK email (the confirmation sent back to the person who submitted the form) will silently fail because their address is not verified. The Lambda handles this gracefully — ACK failure is logged but does not affect the `200 OK` response.

To enable ACKs for real visitors, request SES production access:

1. AWS Console → **SES → Account dashboard → Request production access**
2. Use case: transactional — contact form submissions from a portfolio site
3. Expected volume: very low (personal site)

Production access is usually granted within 24 hours.

## 4. Upgrade DMARC policy after verifying DKIM

The initial DMARC record uses `p=none` (monitoring — no action on failures). Once you have confirmed DKIM is signing correctly (check `Authentication-Results` headers in a received email), upgrade to quarantine:

```zsh
# Edit email.ts: change "v=DMARC1; p=none" to "v=DMARC1; p=quarantine"
# then:
pulumi up
```

## 5. Test a send

After DKIM verification and production access:

```zsh
aws ses send-email \
  --from "do-not-reply@lean.dev.br" \
  --to "<your-notify-email>" \
  --message "Subject={Data=Test,Charset=utf-8},Body={Text={Data=SES test,Charset=utf-8}}"
```

Check that the email arrives and inspect headers for `dkim=pass`, `spf=pass`, `dmarc=pass`.

## Stack outputs

```zsh
pulumi stack output sesDomainIdentity   # lean.dev.br
```

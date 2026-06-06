import * as aws from "@pulumi/aws";

interface EmailArgs {
  zone: aws.route53.Zone;
  domain: string;
}

export function createEmail({ zone, domain }: EmailArgs) {
  const identity = new aws.ses.DomainIdentity("ses-domain-identity", { domain });

  const dkim = new aws.ses.DomainDkim("ses-domain-dkim", {
    domain: identity.domain,
  });

  // 3 CNAME records to prove DKIM ownership
  dkim.dkimTokens.apply((tokens) =>
    tokens.map(
      (token, i) =>
        new aws.route53.Record(`ses-dkim-${String(i)}`, {
          name: `${token}._domainkey.${domain}`,
          type: "CNAME",
          zoneId: zone.zoneId,
          records: [`${token}.dkim.amazonses.com`],
          ttl: 1800,
        })
    )
  );

  // Custom MAIL FROM — lets SPF and DKIM align on the same domain
  new aws.ses.MailFrom("ses-mail-from", {
    domain: identity.domain,
    mailFromDomain: `mail.${domain}`,
  });

  new aws.route53.Record("ses-mail-from-mx", {
    name: `mail.${domain}`,
    type: "MX",
    zoneId: zone.zoneId,
    records: ["10 feedback-smtp.us-east-1.amazonses.com"],
    ttl: 600,
  });

  new aws.route53.Record("ses-mail-from-spf", {
    name: `mail.${domain}`,
    type: "TXT",
    zoneId: zone.zoneId,
    records: ["v=spf1 include:amazonses.com ~all"],
    ttl: 600,
  });

  new aws.route53.Record("ses-dmarc", {
    name: `_dmarc.${domain}`,
    type: "TXT",
    zoneId: zone.zoneId,
    records: ["v=DMARC1; p=none"],
    ttl: 600,
  });

  return { sesIdentityArn: identity.arn };
}

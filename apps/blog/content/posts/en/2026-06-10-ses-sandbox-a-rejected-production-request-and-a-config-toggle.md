---
title: 'SES sandbox, a rejected production request, and a config toggle'
date: 2026-06-10T19:07:00.000Z
description: "Why the contact form's visitor acknowledgement email is currently disabled, and the path to enabling it."
tags: ['aws', 'ses', 'infrastructure', 'decisions']
---

The contact form on this site sends me an email every time someone submits a message. That part works.
There's also a second email — a brief "got your message" acknowledgement to the visitor, if they provided their address.
That part is currently disabled, and here's why.

## SES sandbox

New AWS accounts land in the SES sandbox automatically. In sandbox mode, SES only delivers email to
addresses you have individually verified in the console. That makes the owner-notification email work fine —
I verify my own address once and forget about it. But the visitor ACK has to reach arbitrary addresses,
which the sandbox blocks entirely.

The standard path out is a one-click "request production access" form in the SES console.
I submitted a request describing the use case: a personal portfolio contact form, low volume,
transactional only. AWS rejected it.

The rejection gave no specific reason — their automated review flagged something and that was that.
This usually happens to new accounts with no billing history and no prior sending volume.
There's no technical fault with the setup; it's a trust signal the account hasn't earned yet.

## The decision

Rather than disable the feature permanently or switch email providers, I added a config toggle.
The Lambda reads a `SEND_ACK` environment variable. The infra sets it from a Pulumi stack config key:

```yaml
lean-dev-br-homepage:sendAck: 'false'
```

The owner notification is unaffected. Visitors see a success message in the UI regardless; they just don't get an ACK email.

## The path forward

The re-apply strategy is straightforward:

- Wait for the account to accumulate usage history and a few months of verified sends.
- Submit again with a link to the live site and the GitHub repo — concrete signals that this is a real, low-volume transactional setup, not a spam operation.
- Cite an explicit volume ceiling (the form has reCAPTCHA v3 bot protection and a short message field; volume is structurally bounded).

When production access is granted, `pulumi config set sendAck true && pulumi up` is all it takes to enable that code path again.

import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';

const defaultSes = new SESClient({});

export interface MailOptions {
  from: string;
  to: string;
  replyTo?: string;
  subject: string;
  body: string;
}

export async function sendMail(opts: MailOptions, client: SESClient = defaultSes): Promise<void> {
  await client.send(
    new SendEmailCommand({
      Source: opts.from,
      Destination: { ToAddresses: [opts.to] },
      ReplyToAddresses: opts.replyTo ? [opts.replyTo] : undefined,
      Message: {
        Subject: { Data: opts.subject },
        Body: { Text: { Data: opts.body } },
      },
    }),
  );
}

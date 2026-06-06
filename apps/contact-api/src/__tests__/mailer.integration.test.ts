import { SESClient, VerifyEmailIdentityCommand } from '@aws-sdk/client-ses';
import { LocalstackContainer, type StartedLocalStackContainer } from '@testcontainers/localstack';
import type { Server } from 'node:http';
import { createServer } from 'node:http';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { sendMail } from '../mailer.js';

const SES_REGION = 'us-east-1';

interface SesMessage {
  Id: string;
  Source: string;
  Destination: { ToAddresses: string[] };
  Subject: string;
  Body: { text_part: string | null; html_part: string | null };
}

interface SesDebugResponse {
  messages: SesMessage[];
}

function makeLocalstackSes(container: StartedLocalStackContainer): SESClient {
  const endpoint = container.getConnectionUri();
  return new SESClient({
    region: SES_REGION,
    endpoint,
    credentials: { accessKeyId: 'test', secretAccessKey: 'test' },
  });
}

async function getSentMessages(container: StartedLocalStackContainer): Promise<SesMessage[]> {
  const res = await fetch(`${container.getConnectionUri()}/_aws/ses`);
  const data = (await res.json()) as SesDebugResponse;
  return data.messages;
}

function startMockRecaptcha(response: object): Promise<{ url: string; server: Server }> {
  return new Promise((resolve) => {
    const server = createServer((_req, res) => {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify(response));
    });
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address() as { port: number };
      resolve({ url: `http://127.0.0.1:${String(port)}`, server });
    });
  });
}

describe('sendMail (LocalStack SES)', { timeout: 120_000 }, () => {
  let container: StartedLocalStackContainer;
  let ses: SESClient;
  const FROM = 'sender@lean.dev.br';
  const TO = 'notify@lean.dev.br';

  beforeAll(async () => {
    container = await new LocalstackContainer('localstack/localstack:4').start();
    ses = makeLocalstackSes(container);
    await ses.send(new VerifyEmailIdentityCommand({ EmailAddress: FROM }));
    await ses.send(new VerifyEmailIdentityCommand({ EmailAddress: TO }));
  });

  afterAll(async () => {
    ses.destroy();
    await container.stop();
  });

  it('sends email and LocalStack records subject and body', async () => {
    await sendMail(
      { from: FROM, to: TO, subject: 'Integration test', body: 'Hello LocalStack' },
      ses,
    );

    const messages = await getSentMessages(container);
    const sent = messages.find((m) => m.Source === FROM && m.Destination.ToAddresses.includes(TO));
    expect(sent).toBeDefined();
    expect(sent?.Subject).toBe('Integration test');
    expect(sent?.Body.text_part).toContain('Hello LocalStack');
  });

  it('sends with replyTo and LocalStack records a second message', async () => {
    const before = (await getSentMessages(container)).length;

    await sendMail(
      {
        from: FROM,
        to: TO,
        replyTo: 'visitor@example.com',
        subject: 'Reply-To test',
        body: 'Has reply-to',
      },
      ses,
    );

    const messages = await getSentMessages(container);
    expect(messages.length).toBe(before + 1);
    const sent = messages.find((m) => m.Subject === 'Reply-To test');
    expect(sent).toBeDefined();
    expect(sent?.Body.text_part).toContain('Has reply-to');
  });
});

describe('verifyToken (mock HTTP server)', { timeout: 30_000 }, () => {
  let server: Server | undefined;

  afterAll(() => {
    server?.close();
  });

  it('resolves on passing score', async () => {
    const mock = await startMockRecaptcha({ success: true, score: 0.9, action: 'contact' });
    server?.close();
    server = mock.server;

    const { verifyToken } = await import('../recaptcha.js');
    await expect(verifyToken('tok', 'secret', 'contact', 0.5, mock.url)).resolves.toMatchObject({
      success: true,
      score: 0.9,
    });
  });

  it('throws on low score', async () => {
    const mock = await startMockRecaptcha({ success: true, score: 0.2, action: 'contact' });
    server?.close();
    server = mock.server;

    const { verifyToken } = await import('../recaptcha.js');
    await expect(verifyToken('tok', 'secret', 'contact', 0.5, mock.url)).rejects.toThrow(
      'reCAPTCHA rejected',
    );
  });

  it('throws on wrong action', async () => {
    const mock = await startMockRecaptcha({ success: true, score: 0.9, action: 'login' });
    server?.close();
    server = mock.server;

    const { verifyToken } = await import('../recaptcha.js');
    await expect(verifyToken('tok', 'secret', 'contact', 0.5, mock.url)).rejects.toThrow(
      'reCAPTCHA rejected',
    );
  });
});

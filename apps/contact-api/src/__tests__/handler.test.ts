import type { APIGatewayProxyEventV2 } from 'aws-lambda';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../recaptcha.js', () => ({ verifyToken: vi.fn().mockResolvedValue({ score: 0.9 }) }));
vi.mock('../mailer.js', () => ({ sendMail: vi.fn().mockResolvedValue(undefined) }));

import { verifyToken } from '../recaptcha.js';
import { sendMail } from '../mailer.js';
import { handler } from '../handler.js';

const mockVerify = vi.mocked(verifyToken);
const mockSend = vi.mocked(sendMail);

function makeEvent(body: unknown): APIGatewayProxyEventV2 {
  return {
    body: JSON.stringify(body),
    version: '2.0',
    routeKey: 'POST /api/contact',
    rawPath: '/api/contact',
    rawQueryString: '',
    headers: {},
    requestContext: {} as APIGatewayProxyEventV2['requestContext'],
    isBase64Encoded: false,
  };
}

describe('handler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NOTIFY_EMAIL = 'andre@example.com';
    process.env.FROM_EMAIL = 'do-not-reply@lean.dev.br';
    process.env.RECAPTCHA_SECRET = 'secret';
    process.env.RECAPTCHA_VERIFY_URL = 'https://www.google.com/recaptcha/api/siteverify';
    process.env.RECAPTCHA_ACTION = 'contact';
    process.env.SUBJECT_PREFIX = '[lean.dev.br]';
    process.env.MIN_SCORE = '0.5';
  });

  it('returns 400 when message is missing', async () => {
    const res = await handler(makeEvent({ token: 'tok' }));
    expect(res).toMatchObject({ statusCode: 400 });
    expect(mockVerify).not.toHaveBeenCalled();
  });

  it('returns 400 when token is missing', async () => {
    const res = await handler(makeEvent({ message: 'Hello' }));
    expect(res).toMatchObject({ statusCode: 400 });
    expect(mockVerify).not.toHaveBeenCalled();
  });

  it('returns 403 when reCAPTCHA rejects', async () => {
    mockVerify.mockRejectedValueOnce(new Error('low score'));
    const res = await handler(makeEvent({ message: 'Hello', token: 'bad' }));
    expect(res).toMatchObject({ statusCode: 403 });
    expect(mockSend).not.toHaveBeenCalled();
  });

  it('returns 502 when notify SES call fails', async () => {
    mockSend.mockRejectedValueOnce(new Error('SES error'));
    const res = await handler(makeEvent({ message: 'Hello', token: 'tok' }));
    expect(res).toMatchObject({ statusCode: 502 });
  });

  it('returns 200 and sends notify when valid (no visitor email)', async () => {
    const res = await handler(makeEvent({ message: 'Hello', token: 'tok' }));
    expect(res).toMatchObject({ statusCode: 200 });
    expect(mockSend).toHaveBeenCalledOnce();
    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({ to: 'andre@example.com', replyTo: undefined }),
    );
  });

  it('returns 200, sends notify with Reply-To, and fires ACK when visitor email provided', async () => {
    const res = await handler(
      makeEvent({ message: 'Hello', token: 'tok', email: 'visitor@example.com' }),
    );
    expect(res).toMatchObject({ statusCode: 200 });
    // Let the fire-and-forget ACK settle
    await vi.waitFor(() => { expect(mockSend).toHaveBeenCalledTimes(2); });
    const [notify, ack] = mockSend.mock.calls;
    expect(notify[0]).toMatchObject({ to: 'andre@example.com', replyTo: 'visitor@example.com' });
    expect(ack[0]).toMatchObject({ to: 'visitor@example.com', from: 'do-not-reply@lean.dev.br' });
  });

  it('returns 200 even when ACK email fails', async () => {
    mockSend
      .mockResolvedValueOnce(undefined) // notify ok
      .mockRejectedValueOnce(new Error('ACK failed')); // ack fails
    const res = await handler(
      makeEvent({ message: 'Hello', token: 'tok', email: 'visitor@example.com' }),
    );
    expect(res).toMatchObject({ statusCode: 200 });
    await vi.waitFor(() => { expect(mockSend).toHaveBeenCalledTimes(2); });
  });
});

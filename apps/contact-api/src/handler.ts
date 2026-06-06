import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import { verifyToken } from './recaptcha.js';
import { sendMail } from './mailer.js';

function requireEnv(name: string): string {
  const val = process.env[name];
  if (!val) throw new Error(`Missing required env var: ${name}`);
  return val;
}

function getEnv() {
  return {
    RECAPTCHA_SECRET: requireEnv('RECAPTCHA_SECRET'),
    RECAPTCHA_VERIFY_URL: requireEnv('RECAPTCHA_VERIFY_URL'),
    RECAPTCHA_ACTION: requireEnv('RECAPTCHA_ACTION'),
    NOTIFY_EMAIL: requireEnv('NOTIFY_EMAIL'),
    FROM_EMAIL: requireEnv('FROM_EMAIL'),
    SUBJECT_PREFIX: requireEnv('SUBJECT_PREFIX'),
    MIN_SCORE_NUM: parseFloat(requireEnv('MIN_SCORE')),
  };
}

function json(statusCode: number, body: Record<string, unknown>): APIGatewayProxyResultV2 {
  return { statusCode, body: JSON.stringify(body), headers: { 'content-type': 'application/json' } };
}

function truncate(s: string, max: number): string {
  return s.length <= max ? s : `${s.slice(0, max)}…`;
}

export const handler = async (event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> => {
  const { RECAPTCHA_SECRET, RECAPTCHA_VERIFY_URL, RECAPTCHA_ACTION, NOTIFY_EMAIL, FROM_EMAIL, SUBJECT_PREFIX, MIN_SCORE_NUM } = getEnv();

  let parsed: unknown;
  try {
    parsed = JSON.parse(event.body ?? '{}');
  } catch {
    return json(400, { error: 'Invalid JSON' });
  }

  if (typeof parsed !== 'object' || parsed === null) {
    return json(400, { error: 'Invalid body' });
  }

  const { message, email, token } = parsed as Record<string, unknown>;

  if (typeof token !== 'string' || token.trim().length === 0) {
    return json(400, { error: 'Missing token' });
  }
  if (typeof message !== 'string' || message.trim().length === 0) {
    return json(400, { error: 'Missing message' });
  }

  const visitorEmail = typeof email === 'string' && email.trim().length > 0 ? email.trim() : null;

  try {
    await verifyToken(token, RECAPTCHA_SECRET, RECAPTCHA_ACTION, MIN_SCORE_NUM, RECAPTCHA_VERIFY_URL);
  } catch (err) {
    console.warn('reCAPTCHA rejection:', err);
    return json(403, { error: 'Bot check failed' });
  }

  const subject = `${SUBJECT_PREFIX} ${truncate(message.trim(), 60)}`;
  const notifyBody = [
    `Message: ${message.trim()}`,
    visitorEmail ? `Reply-To: ${visitorEmail}` : '(no reply address provided)',
  ].join('\n\n');

  try {
    await sendMail({
      from: FROM_EMAIL,
      to: NOTIFY_EMAIL,
      replyTo: visitorEmail ?? undefined,
      subject,
      body: notifyBody,
    });
  } catch (err) {
    console.error('SES notify failed:', err);
    return json(502, { error: 'Failed to send message' });
  }

  if (visitorEmail) {
    const ackBody = [
      'Thanks for reaching out!',
      '',
      "Your message has been received. I'll get back to you if possible.",
      '',
      '— André',
    ].join('\n');
    sendMail({
      from: FROM_EMAIL,
      to: visitorEmail,
      subject: 'Got your message',
      body: ackBody,
    }).catch((err: unknown) => {
      console.warn('ACK email failed (non-fatal):', err);
    });
  }

  return json(200, { ok: true });
};

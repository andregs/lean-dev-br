import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import type { Client } from '@openfeature/server-sdk';
import { createFlagClient } from '@lean-dev-br/flags/server';
import { sendMail } from './mailer.js';
import { verifyToken } from './recaptcha.js';

// Initialized at module load (cold start). Subsequent warm invocations reuse
// the same client — no per-request flag fetch.
let _flags: Client | null = null;
async function getFlags(): Promise<Client> {
  if (_flags) return _flags;
  const url = process.env.FLAGS_URL;
  let flagsJson = { flags: {} };
  if (url) {
    try {
      flagsJson = await fetch(url).then((r) => r.json() as Promise<typeof flagsJson>);
    } catch (err) {
      console.warn('flags fetch failed, defaulting all flags to caller default:', err);
    }
  }
  _flags = await createFlagClient(flagsJson);
  return _flags;
}

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
  return {
    statusCode,
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  };
}

function problem(status: number, title: string): APIGatewayProxyResultV2 {
  return {
    statusCode: status,
    body: JSON.stringify({ type: 'about:blank', status, title }),
    headers: { 'content-type': 'application/problem+json' },
  };
}

function truncate(s: string, max: number): string {
  return s.length <= max ? s : `${s.slice(0, max)}…`;
}

const SUPPORTED_LOCALES = ['en-US', 'pt-BR'] as const;
type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

const ACK_TEMPLATES: Record<SupportedLocale, { subject: string; body: string }> = {
  'en-US': {
    subject: 'Got your message',
    body: [
      'Thanks for reaching out!',
      '',
      "Your message has been received. I'll get back to you if possible.",
      '',
      '— André',
    ].join('\n'),
  },
  'pt-BR': {
    subject: 'Mensagem recebida',
    body: [
      'Obrigado pelo contato!',
      '',
      'Sua mensagem foi recebida. Retornarei assim que possível.',
      '',
      '— André',
    ].join('\n'),
  },
};

export const handler = async (event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> => {
  // Flags client available for future use; initialized once per warm instance.
  await getFlags();

  if (event.rawPath === '/api/csp-report') {
    // Cap is supplied by infra (CSP_REPORT_MAX_BYTES); if absent, log full body
    const maxBytes = Number(process.env.CSP_REPORT_MAX_BYTES);
    const body = event.body ?? '';
    console.log('csp-report:', Number.isFinite(maxBytes) ? body.slice(0, maxBytes) : body);
    return { statusCode: 204, body: '' };
  }

  const {
    RECAPTCHA_SECRET,
    RECAPTCHA_VERIFY_URL,
    RECAPTCHA_ACTION,
    NOTIFY_EMAIL,
    FROM_EMAIL,
    SUBJECT_PREFIX,
    MIN_SCORE_NUM,
  } = getEnv();

  let parsed: unknown;
  try {
    parsed = JSON.parse(event.body ?? '{}');
  } catch {
    return problem(400, 'Invalid JSON');
  }

  if (typeof parsed !== 'object' || parsed === null) {
    return problem(400, 'Invalid body');
  }

  const { message, email, token, locale: rawLocale } = parsed as Record<string, unknown>;

  if (typeof token !== 'string' || token.trim().length === 0) {
    return problem(400, 'Missing token');
  }
  if (typeof message !== 'string' || message.trim().length === 0) {
    return problem(400, 'Missing message');
  }

  const locale: SupportedLocale =
    typeof rawLocale === 'string' && (SUPPORTED_LOCALES as readonly string[]).includes(rawLocale)
      ? (rawLocale as SupportedLocale)
      : 'en-US';

  const visitorEmail = typeof email === 'string' && email.trim().length > 0 ? email.trim() : null;

  try {
    await verifyToken(
      token,
      RECAPTCHA_SECRET,
      RECAPTCHA_ACTION,
      MIN_SCORE_NUM,
      RECAPTCHA_VERIFY_URL,
    );
  } catch (err) {
    console.warn('reCAPTCHA rejection:', err);
    return problem(403, 'Bot check failed');
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
    return problem(502, 'Failed to send message');
  }

  // ACK disabled while SES is in sandbox (requires production access to send to unverified addresses).
  // Enable via Pulumi config: `pulumi config set sendAck true`
  if (visitorEmail && process.env.SEND_ACK === 'true') {
    const ack = ACK_TEMPLATES[locale];
    sendMail({
      from: FROM_EMAIL,
      to: visitorEmail,
      subject: ack.subject,
      body: ack.body,
    }).catch((err: unknown) => {
      console.warn('ACK email failed (non-fatal):', err);
    });
  }

  return json(200, { ok: true });
};

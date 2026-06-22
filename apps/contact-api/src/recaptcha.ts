export interface RecaptchaResult {
  success: boolean;
  score: number;
  action: string;
}

export async function verifyToken(
  token: string,
  secret: string,
  expectedAction: string,
  minScore: number,
  verifyUrl: string,
): Promise<RecaptchaResult> {
  const params = new URLSearchParams({ secret, response: token });
  const res = await fetch(verifyUrl, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  });

  const raw: unknown = await res.json();

  if (typeof raw !== 'object' || raw === null || !('success' in raw)) {
    throw new Error('Unexpected siteverify response shape');
  }

  if (raw.success !== true) {
    const codes =
      'error-codes' in raw && Array.isArray(raw['error-codes'])
        ? (raw['error-codes'] as string[]).join(', ')
        : 'unknown';
    throw new Error(`reCAPTCHA rejected by Google: ${codes}`);
  }

  if (!('score' in raw) || !('action' in raw)) {
    throw new Error('Unexpected siteverify response shape: missing score or action');
  }

  const result: RecaptchaResult = {
    success: true,
    score: typeof raw.score === 'number' ? raw.score : 0,
    action: typeof raw.action === 'string' ? raw.action : '',
  };

  if (result.action !== expectedAction || result.score < minScore) {
    throw new Error(`reCAPTCHA rejected: action=${result.action} score=${String(result.score)}`);
  }

  return result;
}

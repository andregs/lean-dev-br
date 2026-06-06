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

  if (
    typeof raw !== 'object' ||
    raw === null ||
    !('success' in raw) ||
    !('score' in raw) ||
    !('action' in raw)
  ) {
    throw new Error('Unexpected siteverify response shape');
  }

  const result: RecaptchaResult = {
    success: raw.success === true,
    score: typeof raw.score === 'number' ? raw.score : 0,
    action: typeof raw.action === 'string' ? raw.action : '',
  };

  if (!result.success || result.action !== expectedAction || result.score < minScore) {
    throw new Error(
      `reCAPTCHA rejected: success=${String(result.success)} action=${result.action} score=${String(result.score)}`,
    );
  }

  return result;
}

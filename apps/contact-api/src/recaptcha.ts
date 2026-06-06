import { request } from 'node:https';

export interface RecaptchaResult {
  success: boolean;
  score: number;
  action: string;
}

function post(url: string, params: URLSearchParams): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const body = params.toString();
    const req = request(
      url,
      {
        method: 'POST',
        headers: {
          'content-type': 'application/x-www-form-urlencoded',
          'content-length': Buffer.byteLength(body),
        },
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk: Buffer) => {
          chunks.push(chunk);
        });
        res.on('end', () => {
          try {
            resolve(JSON.parse(Buffer.concat(chunks).toString()));
          } catch (err) {
            reject(err instanceof Error ? err : new Error(String(err)));
          }
        });
      },
    );
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

export async function verifyToken(
  token: string,
  secret: string,
  expectedAction: string,
  minScore: number,
  verifyUrl: string,
): Promise<RecaptchaResult> {
  const params = new URLSearchParams({ secret, response: token });
  const raw = await post(verifyUrl, params);

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

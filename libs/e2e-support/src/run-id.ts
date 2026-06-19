import { randomBytes } from 'node:crypto';

/** Stable within one Playwright worker process; changes each run. */
let _id: string | undefined;

export function runId(): string {
  if (!_id) {
    const ts = Date.now().toString(36);
    const rand = randomBytes(3).toString('hex');
    _id = `${ts}-${rand}`;
  }
  return _id;
}

/** Prefix for test-created resources, e.g. Firestore room IDs or blog slugs. */
export function testPrefix(): string {
  return `e2e-${runId()}`;
}

import { isProd, sweepStaleBlogDrafts } from '@lean-dev-br/e2e-support';

const LOCAL_PORT = 3001;

export default async function globalSetup(): Promise<void> {
  if (isProd()) return;
  await sweepStaleBlogDrafts(`http://localhost:${String(LOCAL_PORT)}/blog`);
}

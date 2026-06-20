import { isProd, teardownBlogDrafts } from '@lean-dev-br/e2e-support';

const LOCAL_PORT = 3001;

export default async function globalTeardown(): Promise<void> {
  if (isProd()) return;
  await teardownBlogDrafts(`http://localhost:${String(LOCAL_PORT)}/blog`);
}

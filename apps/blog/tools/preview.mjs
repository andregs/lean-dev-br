// @ts-check
// Prod preview: serves the static export (apps/blog/out) under /blog with the
// *production* blog CSP, emulating CloudFront — so Trusted Types enforcement can
// be validated locally (`next start` can't serve `output: export`). This is also
// the static target for future Playwright e2e. Run: `nx preview blog`.
import { readFile } from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { cspHeader } from '@lean-dev-br/csp';

const dir = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(dir, '..', 'out');
const CSP = cspHeader({ mode: 'prod', app: 'blog' });
const PORT = 4000;

/** @type {Record<string, string>} */
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.xml': 'application/xml; charset=utf-8',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
  '.woff2': 'font/woff2',
  '.png': 'image/png',
  '.map': 'application/json',
};

/** Map a /blog request path to a file in the export. @param {string} urlPath */
function resolveFile(urlPath) {
  if (urlPath === '/blog') return path.join(OUT, 'index.html');
  if (!urlPath.startsWith('/blog/')) return null;
  let file = path.join(OUT, urlPath.slice('/blog/'.length));
  if (urlPath.endsWith('/')) file = path.join(file, 'index.html');
  return path.normalize(file);
}

http
  .createServer((req, res) => {
    const urlPath = decodeURIComponent((req.url ?? '/').split('?')[0]);
    const file = resolveFile(urlPath);
    const base = { 'Content-Security-Policy': CSP };

    void (async () => {
      if (!file || !file.startsWith(OUT)) {
        res.writeHead(404, { ...base, 'Content-Type': 'text/plain' });
        res.end('not found');
        return;
      }
      // Try exact path first, fall back to appending .html (for extensionless route links).
      let resolved = file;
      let data;
      try {
        data = await readFile(resolved);
      } catch {
        resolved = `${file}.html`;
        try {
          data = await readFile(resolved);
        } catch {
          const notFound = await readFile(path.join(OUT, '404.html')).catch(() => 'not found');
          res.writeHead(404, { ...base, 'Content-Type': 'text/html; charset=utf-8' });
          res.end(notFound);
          return;
        }
      }
      const ext = path.extname(resolved);
      const type = TYPES[ext] ?? 'application/octet-stream';
      res.writeHead(200, { ...base, 'Content-Type': type });
      res.end(data);
    })();
  })
  .listen(PORT, () => {
    console.log(`blog prod preview → http://localhost:${PORT}/blog/`);
    console.log(`CSP: ${CSP}`);
  });

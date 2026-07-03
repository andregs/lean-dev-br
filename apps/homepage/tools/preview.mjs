// @ts-check
// Unified prod preview: serves apex (dist/), blog (apps/blog/out/), todo
// (apps/todo/dist/), and ui-modulith (apps/ui-modulith/dist/) from one origin
// with production CSP headers, emulating the CloudFront edge routing.
// Validates CSP/TT enforcement across all apps before deploying.
// Run: `pnpm nx run homepage:preview-all`
import { readFile } from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { cspHeader } from '@lean-dev-br/csp';

const dir = path.dirname(fileURLToPath(import.meta.url));
const APEX = path.resolve(dir, '..', 'dist');
const BLOG = path.resolve(dir, '..', '..', 'blog', 'out');
const TODO = path.resolve(dir, '..', '..', 'todo', 'dist');
const UI_MODULITH = path.resolve(dir, '..', '..', 'ui-modulith', 'dist');
const CSP_APEX = cspHeader({ mode: 'prod' });
const CSP_BLOG = cspHeader({ mode: 'prod', app: 'blog' });
const CSP_TODO = cspHeader({ mode: 'prod', app: 'todo', signalUrl: 'http://localhost:8080' });
const CSP_UI_MODULITH = cspHeader({ mode: 'prod', app: 'ui-modulith' });
const PORT = 4173;

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

/**
 * Emulate cloudfront-edge.js routing.
 * Returns { root, filePath, csp } or { redirect } or { status: 404 }.
 * @param {string} uri
 */
function route(uri) {
  if (uri === '/blog') return { redirect: '/blog/' };
  if (uri === '/todo') return { redirect: '/todo/' };
  if (uri === '/labs/ui-modulith') return { redirect: '/labs/ui-modulith/' };

  if (uri.startsWith('/blog/')) {
    let stripped = uri.slice('/blog'.length);
    if (stripped.endsWith('/')) stripped += 'index.html';
    const filePath = path.join(BLOG, stripped);
    return { root: BLOG, filePath: path.normalize(filePath), csp: CSP_BLOG };
  }

  if (uri.startsWith('/todo/')) {
    const stripped = uri.slice('/todo'.length); // '/todo/assets/x.js' → '/assets/x.js'
    const localPath = stripped.match(/\.[^/]+$/) ? stripped : '/index.html';
    return { root: TODO, filePath: path.join(TODO, localPath), csp: CSP_TODO };
  }

  if (uri.startsWith('/labs/ui-modulith/')) {
    const stripped = uri.slice('/labs/ui-modulith'.length);
    const localPath = stripped.match(/\.[^/]+$/) ? stripped : '/index.html';
    return { root: UI_MODULITH, filePath: path.join(UI_MODULITH, localPath), csp: CSP_UI_MODULITH };
  }

  // Apex SPA fallback: extensionless paths → index.html.
  const apexPath = uri.match(/\.[^/]+$/) ? uri : '/index.html';
  return { root: APEX, filePath: path.join(APEX, apexPath), csp: CSP_APEX };
}

http
  .createServer((req, res) => {
    const uri = decodeURIComponent((req.url ?? '/').split('?')[0]);
    const result = route(uri);

    void (async () => {
      if ('redirect' in result) {
        res.writeHead(301, { Location: result.redirect });
        res.end();
        return;
      }

      const base = { 'Content-Security-Policy': result.csp };

      if (!result.filePath.startsWith(result.root)) {
        res.writeHead(403, { ...base, 'Content-Type': 'text/plain' });
        res.end('forbidden');
        return;
      }

      try {
        const data = await readFile(result.filePath);
        const ext = path.extname(result.filePath);
        res.writeHead(200, { ...base, 'Content-Type': TYPES[ext] ?? 'application/octet-stream' });
        res.end(data);
      } catch {
        res.writeHead(404, { ...base, 'Content-Type': 'text/plain' });
        res.end('not found');
      }
    })();
  })
  .listen(PORT, () => {
    console.log(`prod preview → http://localhost:${PORT}/`);
    console.log(`             → http://localhost:${PORT}/blog/`);
    console.log(`             → http://localhost:${PORT}/todo/`);
    console.log(`             → http://localhost:${PORT}/labs/ui-modulith/`);
  });

// eslint-disable-next-line @typescript-eslint/no-unused-vars -- CF runtime entry point
/** @param {any} event */
function handler(event) {
  const req = event.request;
  const host = req.headers.host.value;

  if (host === 'www.lean.dev.br') {
    return {
      statusCode: 301,
      statusDescription: 'Moved Permanently',
      headers: { location: { value: 'https://lean.dev.br' + req.uri } },
    };
  }

  // /blog (no trailing slash) only reaches the default behavior — /blog/* doesn't match it.
  // Redirect to /blog/ so the next request matches the /blog/* behavior (blog-s3 origin).
  if (req.uri === '/blog') {
    return {
      statusCode: 301,
      statusDescription: 'Moved Permanently',
      headers: { location: { value: '/blog/' } },
    };
  }

  // Blog routing (runs under /blog/* and /blog/_next/* behaviors, never the default):
  // strip /blog prefix so paths resolve in the dedicated blog bucket root.
  // trailingSlash:true emits foo/index.html; rewrite trailing-slash paths accordingly.
  // Extensionless paths (e.g. opengraph-image.png) pass through after prefix strip.
  if (req.uri === '/blog/') {
    req.uri = '/index.html';
    return req;
  }
  if (req.uri.startsWith('/blog/')) {
    req.uri = req.uri.slice('/blog'.length);
    if (req.uri.endsWith('/')) req.uri += 'index.html';
    return req;
  }

  // Apex SPA fallback: rewrite extensionless paths to /index.html so History API routes work
  if (!req.uri.match(/\.[^/]+$/)) {
    req.uri = '/index.html';
  }

  return req;
}

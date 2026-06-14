// eslint-disable-next-line @typescript-eslint/no-unused-vars -- CF runtime entry point
/** @param {any} event */
function handler(event) {
  const req = event.request;

  if (req.headers.host.value === 'www.lean.dev.br') {
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

  // Blog routing: strip /blog prefix so paths resolve in the dedicated blog bucket root.
  // Next exports trailingSlash:true — trailing slash maps to index.html; assets pass through.
  if (req.uri.startsWith('/blog/')) {
    req.uri = req.uri.slice('/blog'.length);
    if (req.uri.endsWith('/')) req.uri += 'index.html';
    return req;
  }

  // /todo (no trailing slash) only reaches the default behavior — redirect to /todo/
  if (req.uri === '/todo') {
    return {
      statusCode: 301,
      statusDescription: 'Moved Permanently',
      headers: { location: { value: '/todo/' } },
    };
  }

  // Todo routing: strip /todo prefix so paths resolve in the dedicated todo bucket root.
  // Vite SPA: extensionless paths (and trailing-slash paths) fall back to index.html.
  if (req.uri.startsWith('/todo/')) {
    req.uri = req.uri.slice('/todo'.length);
    if (!req.uri.match(/\.[^/]+$/)) req.uri = '/index.html';
    return req;
  }

  // Apex SPA fallback: rewrite extensionless paths to /index.html so History API routes work.
  if (!req.uri.match(/\.[^/]+$/)) req.uri = '/index.html';
  return req;
}

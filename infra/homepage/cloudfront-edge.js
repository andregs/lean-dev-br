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

  // /labs/ui-modulith (no trailing slash) only reaches the default behavior — redirect.
  if (req.uri === '/labs/ui-modulith') {
    return {
      statusCode: 301,
      statusDescription: 'Moved Permanently',
      headers: { location: { value: '/labs/ui-modulith/' } },
    };
  }

  // ui-modulith routing: strip /labs/ui-modulith prefix so paths resolve in the dedicated
  // bucket root. React Router SPA: extensionless paths fall back to index.html, same as /todo/*.
  if (req.uri.startsWith('/labs/ui-modulith/')) {
    req.uri = req.uri.slice('/labs/ui-modulith'.length);
    if (!req.uri.match(/\.[^/]+$/)) req.uri = '/index.html';
    return req;
  }

  // /labs/federation(/catalog|/cart) (no trailing slash) only reach the default
  // behavior — redirect each to its trailing-slash form.
  if (
    req.uri === '/labs/federation' ||
    req.uri === '/labs/federation/catalog' ||
    req.uri === '/labs/federation/cart'
  ) {
    return {
      statusCode: 301,
      statusDescription: 'Moved Permanently',
      headers: { location: { value: req.uri + '/' } },
    };
  }

  // Module Federation routing: catalog and cart are checked before the shell's
  // broader /labs/federation/ prefix below, since both their paths also start
  // with it — the more specific pattern must strip first, matching the order of
  // the CloudFront distribution's own orderedCacheBehaviors. remoteEntry.js and
  // shared chunks are plain content URLs (have an extension), so only
  // extensionless paths fall back to index.html, same as /labs/ui-modulith/*.
  if (req.uri.startsWith('/labs/federation/catalog/')) {
    req.uri = req.uri.slice('/labs/federation/catalog'.length);
    if (!req.uri.match(/\.[^/]+$/)) req.uri = '/index.html';
    return req;
  }
  if (req.uri.startsWith('/labs/federation/cart/')) {
    req.uri = req.uri.slice('/labs/federation/cart'.length);
    if (!req.uri.match(/\.[^/]+$/)) req.uri = '/index.html';
    return req;
  }
  if (req.uri.startsWith('/labs/federation/')) {
    req.uri = req.uri.slice('/labs/federation'.length);
    if (!req.uri.match(/\.[^/]+$/)) req.uri = '/index.html';
    return req;
  }

  // Apex SPA fallback: rewrite extensionless paths to /index.html so History API routes work.
  if (!req.uri.match(/\.[^/]+$/)) req.uri = '/index.html';
  return req;
}

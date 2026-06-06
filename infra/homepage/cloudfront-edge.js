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

  // SPA fallback: rewrite extensionless paths to /index.html so History API routes work
  if (!req.uri.match(/\.[^/]+$/)) {
    req.uri = '/index.html';
  }

  return req;
}

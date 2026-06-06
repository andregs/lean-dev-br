function handler(event) {
  var host = event.request.headers.host.value;
  if (host === 'www.lean.dev.br') {
    return {
      statusCode: 301,
      statusDescription: 'Moved Permanently',
      headers: { location: { value: 'https://lean.dev.br' + event.request.uri } }
    };
  }
  return event.request;
}

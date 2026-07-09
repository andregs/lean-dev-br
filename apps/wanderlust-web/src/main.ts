import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { App } from './app/app';

// MSW stands in for the BFF until iteration 2 wires real gRPC/REST - runs in
// every environment (dev, e2e, static build) since there's nothing to deploy
// behind it yet.
async function prepare() {
  const { worker } = await import('./mocks/browser');
  await worker.start({
    serviceWorker: { url: '/mockServiceWorker.js' },
    onUnhandledRequest: 'bypass',
  });
}

void prepare().then(() => {
  bootstrapApplication(App, appConfig).catch((err: unknown) => {
    console.error(err);
  });
});

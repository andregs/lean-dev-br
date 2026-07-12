import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { App } from './app/app';
import { environment } from './environments/environment';

// MSW stands in for the BFF by default (dev, e2e, static build) since nothing's
// deployed behind it yet. The `backend` serve configuration flips mswEnabled off
// and proxies /api to a real wanderlust-bff instead - see proxy.conf.json.
async function prepare() {
  if (!environment.mswEnabled) {
    return;
  }
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

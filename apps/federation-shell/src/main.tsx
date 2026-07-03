import { StrictMode } from 'react';
import * as ReactDOM from 'react-dom/client';
import App from './app/app';

// MSW is the permanent mock backend for this demo — there's no real API to
// deploy behind it, so this runs in every environment, dev, preview, and the
// real static production build alike. Lives in the shell only: service
// workers intercept at the page/origin level, so catalog and cart's own
// apiClient calls get caught too, regardless of which remote made them.
async function prepare() {
  const { worker } = await import('./mocks/browser');
  await worker.start({
    serviceWorker: { url: `${import.meta.env.BASE_URL}mockServiceWorker.js` },
    onUnhandledRequest: 'bypass',
  });
}

void prepare().then(() => {
  const rootElement = document.getElementById('root');
  if (!rootElement) throw new Error('Root element not found.');
  ReactDOM.createRoot(rootElement).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
});

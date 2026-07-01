import { StrictMode } from 'react';
import ReactDOM from 'react-dom/client';
import App from './app';

// MSW is the permanent mock backend for this demo — there's no real API to
// deploy behind it (see infra notes), so this runs in every environment,
// dev, preview, and the real static production build alike.
async function prepare() {
  const { worker } = await import('./mocks/browser');
  await worker.start({
    serviceWorker: { url: `${import.meta.env.BASE_URL}mockServiceWorker.js` },
    onUnhandledRequest: 'bypass',
  });
}

void prepare().then(() => {
  const root = document.getElementById('root');
  if (!root) throw new Error('Root element not found.');
  ReactDOM.createRoot(root).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
});

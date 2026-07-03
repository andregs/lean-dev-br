import { StrictMode } from 'react';
import * as ReactDOM from 'react-dom/client';
import App from './app/app';

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('Root element not found.');

ReactDOM.createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

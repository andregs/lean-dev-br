import { BrowserRouter } from 'react-router-dom';
import { I18nextProvider } from 'react-i18next';
import { BusProvider } from '@lean-dev-br/federation-kernel';
import { SiteNav, SiteFooter } from '@lean-dev-br/design-system/react';
import { i18n } from '../i18n';
import { DemoBar } from '../components/DemoBar';
import { AppRoutes } from '../routes';
import '../app.css';

export function App() {
  return (
    <I18nextProvider i18n={i18n}>
      <BrowserRouter basename="/labs/federation">
        <BusProvider>
          <div className="page-shell">
            <SiteNav logoUrl={`${import.meta.env.BASE_URL}logo.svg#brand-mark`} />
            <div className="nav-spacer" aria-hidden="true" />
            <DemoBar />
            <div className="page-content">
              <AppRoutes />
            </div>
            <SiteFooter />
          </div>
        </BusProvider>
      </BrowserRouter>
    </I18nextProvider>
  );
}

export default App;

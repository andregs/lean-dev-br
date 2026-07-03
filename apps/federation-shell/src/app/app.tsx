import { BrowserRouter } from 'react-router-dom';
import { BusProvider } from '@lean-dev-br/federation-kernel';
import { AppRoutes } from '../routes';

export function App() {
  return (
    <BusProvider>
      <BrowserRouter basename="/labs/federation">
        <AppRoutes />
      </BrowserRouter>
    </BusProvider>
  );
}

export default App;

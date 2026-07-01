import { Route, Routes } from 'react-router-dom';
import { CartPage } from './components/CartPage';

export default function CartRoutes() {
  return (
    <Routes>
      <Route index element={<CartPage />} />
    </Routes>
  );
}

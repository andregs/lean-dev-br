import { Route, Routes } from 'react-router-dom';
import { CartPage } from './components/CartPage';

export function CartRoutes() {
  return (
    <Routes>
      <Route index element={<CartPage />} />
    </Routes>
  );
}

export default CartRoutes;

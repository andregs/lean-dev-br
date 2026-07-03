import { Route, Routes } from 'react-router-dom';

function CartPlaceholder() {
  return <p data-testid="cart-placeholder">cart remote loaded</p>;
}

export function CartRoutes() {
  return (
    <Routes>
      <Route path="/*" element={<CartPlaceholder />} />
    </Routes>
  );
}

export default CartRoutes;

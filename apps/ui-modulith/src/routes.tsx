import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';

const CatalogRoutes = lazy(() => import('@lean-dev-br/ui-modulith-catalog'));
const CartRoutes = lazy(() => import('@lean-dev-br/ui-modulith-cart'));

function Loading() {
  return <div className="loading-shell">Loading…</div>;
}

export function AppRoutes() {
  return (
    <Suspense fallback={<Loading />}>
      <Routes>
        <Route path="/" element={<Navigate to="/catalog" replace />} />
        <Route path="/catalog/*" element={<CatalogRoutes />} />
        <Route path="/cart/*" element={<CartRoutes />} />
        <Route path="*" element={<Navigate to="/catalog" replace />} />
      </Routes>
    </Suspense>
  );
}

import { Route, Routes } from 'react-router-dom';
import { CatalogPage } from './components/CatalogPage';
import { ProductDetail } from './components/ProductDetail';

export function CatalogRoutes() {
  return (
    <Routes>
      <Route index element={<CatalogPage />} />
      <Route path=":sku" element={<ProductDetail />} />
    </Routes>
  );
}

export default CatalogRoutes;

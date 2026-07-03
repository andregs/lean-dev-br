import { Route, Routes } from 'react-router-dom';

function CatalogPlaceholder() {
  return <p data-testid="catalog-placeholder">catalog remote loaded</p>;
}

export function CatalogRoutes() {
  return (
    <Routes>
      <Route path="/*" element={<CatalogPlaceholder />} />
    </Routes>
  );
}

export default CatalogRoutes;

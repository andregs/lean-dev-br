// dts generation is disabled (see vite.config.mts) — its default output path collides
// with ESLint's typed-linting project service. These remotes are resolved at
// runtime by the MF2 vite plugin; declare their shape by hand instead.
declare module 'catalog/Routes' {
  import type { ComponentType } from 'react';
  const CatalogRoutes: ComponentType;
  export default CatalogRoutes;
}

declare module 'cart/Routes' {
  import type { ComponentType } from 'react';
  const CartRoutes: ComponentType;
  export default CartRoutes;
}

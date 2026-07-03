// Fallback for CI/cold builds: MF2's cross-remote type generation (dts: true in
// vite.config.mts) only works with a live remote dev server — `consumeTypes`
// fetches over HTTP with no local-file fallback (confirmed via FEDERATION_DEBUG).
// tsconfig.app.json's `paths` mapping always prefers the real generated
// @mf-types/ file when present (`nx serve` with live remotes); this ambient
// declaration is only reached when that file doesn't exist.
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

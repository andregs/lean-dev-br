import type { ApiPaths } from '@lean-dev-br/ui-modulith-kernel';
import { apiClient } from '@lean-dev-br/ui-modulith-kernel';
// Boundary proof -- uncomment and run `nx lint catalog` to see this fail with
// @nx/enforce-module-boundaries: "type:feature" can only depend on "type:kernel", "scope:shared".
// import { useCartLines } from '@lean-dev-br/ui-modulith-cart';

export type Product =
  ApiPaths['/products']['get']['responses']['200']['content']['application/json'][number];

export async function listProducts(): Promise<Product[]> {
  const { data, error } = await apiClient.GET('/products');
  if (error) throw new Error('Failed to load products');
  return data;
}

export async function getProduct(sku: string): Promise<Product | null> {
  const { data, response } = await apiClient.GET('/products/{sku}', {
    params: { path: { sku } },
  });
  if (response.status === 404) return null;
  return data ?? null;
}

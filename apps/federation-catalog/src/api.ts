import type { ApiPaths } from '@lean-dev-br/federation-kernel';
import { apiClient } from '@lean-dev-br/federation-kernel';
// Boundary proof, federation-style: unlike the modulith twin (where this is an
// Nx lint rule), there's no import path to the cart remote at all — it's a
// separate Vite root with its own src/ tree, never on this app's module graph.
// import { useCartLines } from '???'; // literally nothing to import

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

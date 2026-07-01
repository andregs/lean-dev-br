import { apiClient } from '@lean-dev-br/ui-modulith-kernel';
import type { ApiPaths } from '@lean-dev-br/ui-modulith-kernel';

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

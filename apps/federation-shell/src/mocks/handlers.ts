import { HttpResponse } from 'msw';
import { createOpenApiHttp } from 'openapi-msw';
import type { ApiPaths } from '@lean-dev-br/federation-kernel';

const http = createOpenApiHttp<ApiPaths>({ baseUrl: '/labs/federation/api' });

const PRODUCTS = [
  {
    sku: 'WIDGET-001',
    name: 'Super Widget',
    price: 29.99,
    description: 'A very fine widget.',
    imageUrl: '/labs/federation/images/widget-001.jpg',
  },
  {
    sku: 'GADGET-002',
    name: 'Power Gadget',
    price: 49.99,
    description: 'Gadget with turbo mode.',
    imageUrl: '/labs/federation/images/gadget-002.jpg',
  },
  {
    sku: 'DOOHICKEY-003',
    name: 'Deluxe Doohickey',
    price: 14.99,
    description: 'Does the thing you need done.',
    imageUrl: '/labs/federation/images/doohickey-003.jpg',
  },
];

export const handlers = [
  http.get('/products', () => HttpResponse.json(PRODUCTS)),

  http.get('/products/{sku}', ({ params }) => {
    const product = PRODUCTS.find((p) => p.sku === params.sku);
    if (!product) {
      return HttpResponse.json(
        { type: 'about:blank', title: 'Not Found', status: 404 },
        { status: 404, headers: { 'content-type': 'application/problem+json' } },
      );
    }
    return HttpResponse.json(product);
  }),
];

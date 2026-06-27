import { HttpResponse } from 'msw';
import { createOpenApiHttp } from 'openapi-msw';
import type { ApiPaths } from '@lean-dev-br/ui-modulith-kernel';

const http = createOpenApiHttp<ApiPaths>({ baseUrl: '/labs/ui-modulith/api' });

const PRODUCTS = [
  {
    sku: 'WIDGET-001',
    name: 'Super Widget',
    price: 29.99,
    description: 'A very fine widget.',
    imageUrl: '/labs/ui-modulith/images/widget-001.jpg',
  },
  {
    sku: 'GADGET-002',
    name: 'Power Gadget',
    price: 49.99,
    description: 'Gadget with turbo mode.',
    imageUrl: '/labs/ui-modulith/images/gadget-002.jpg',
  },
  {
    sku: 'DOOHICKEY-003',
    name: 'Deluxe Doohickey',
    price: 14.99,
    description: 'Does the thing you need done.',
    imageUrl: '/labs/ui-modulith/images/doohickey-003.jpg',
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

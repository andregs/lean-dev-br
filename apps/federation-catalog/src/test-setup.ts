import { afterAll, afterEach, beforeAll } from 'vitest';
import { cleanup } from '@testing-library/react';
import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';

const PRODUCTS = [
  {
    sku: 'WIDGET-001',
    name: 'Super Widget',
    price: 29.99,
    description: 'A very fine widget.',
    imageUrl: '',
  },
  {
    sku: 'GADGET-002',
    name: 'Power Gadget',
    price: 49.99,
    description: 'Gadget with turbo mode.',
    imageUrl: '',
  },
];

export const server = setupServer(
  http.get('http://localhost/labs/federation/api/products', () => HttpResponse.json(PRODUCTS)),

  http.get('http://localhost/labs/federation/api/products/:sku', ({ params }) => {
    const product = PRODUCTS.find((p) => p.sku === params.sku);
    if (!product) {
      return HttpResponse.json(
        { type: 'about:blank', title: 'Not Found', status: 404 },
        { status: 404, headers: { 'content-type': 'application/problem+json' } },
      );
    }
    return HttpResponse.json(product);
  }),
);

beforeAll(() => {
  server.listen({ onUnhandledRequest: 'warn' });
});
afterEach(() => {
  server.resetHandlers();
  cleanup();
});
afterAll(() => {
  server.close();
});

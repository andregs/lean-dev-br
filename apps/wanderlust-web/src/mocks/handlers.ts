import { HttpResponse } from 'msw';
import { createOpenApiHttp } from 'openapi-msw';
import type { ApiPaths } from '@lean-dev-br/wanderlust-contracts';

const http = createOpenApiHttp<ApiPaths>({ baseUrl: '/api' });

const DESTINATIONS = [
  {
    id: 'lisbon-pt',
    name: 'Lisbon',
    country: 'Portugal',
    description: 'Hilly riverside capital known for tiled facades and fado.',
    imageUrl: '/images/lisbon.jpg',
  },
  {
    id: 'kyoto-jp',
    name: 'Kyoto',
    country: 'Japan',
    description: 'Former imperial capital, temples and gardens.',
    imageUrl: '/images/kyoto.jpg',
  },
  {
    id: 'reykjavik-is',
    name: 'Reykjavik',
    country: 'Iceland',
    description: 'Gateway to glaciers, geysers, and the northern lights.',
    imageUrl: '/images/reykjavik.jpg',
  },
];

export const handlers = [
  http.get('/destinations', () => HttpResponse.json(DESTINATIONS)),

  http.get('/destinations/{id}', ({ params }) => {
    const destination = DESTINATIONS.find((d) => d.id === params.id);
    if (!destination) {
      return HttpResponse.json(
        { type: 'about:blank', title: 'Not Found', status: 404 },
        { status: 404, headers: { 'content-type': 'application/problem+json' } },
      );
    }
    return HttpResponse.json(destination);
  }),
];

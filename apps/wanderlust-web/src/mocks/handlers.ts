import { HttpResponse } from 'msw';
import { createOpenApiHttp } from 'openapi-msw';
import type { ApiPaths } from '@lean-dev-br/wanderlust-contracts';

const http = createOpenApiHttp<ApiPaths>({ baseUrl: '/api' });

const DESTINATIONS = [
  {
    id: 'fernando-de-noronha-br',
    name: 'Fernando de Noronha',
    country: 'Brazil',
    description: 'Volcanic archipelago with turquoise bays and spinner dolphins.',
    imageUrl: '/images/fernando-de-noronha.jpg',
    latitude: -3.85,
    longitude: -32.42,
    weather: { temperatureC: 27.4, weatherCode: 1 },
  },
  {
    id: 'machu-picchu-pe',
    name: 'Machu Picchu',
    country: 'Peru',
    description: 'Incan citadel perched above the Sacred Valley.',
    imageUrl: '/images/machu-picchu.jpg',
    latitude: -13.16,
    longitude: -72.54,
    weather: { temperatureC: 14.8, weatherCode: 3 },
  },
  {
    id: 'tierra-del-fuego-ar',
    name: 'Tierra del Fuego',
    country: 'Argentina',
    description: 'Windswept archipelago at the southern tip of the continent.',
    imageUrl: '/images/tierra-del-fuego.jpg',
    latitude: -54.8,
    longitude: -68.3,
    weather: { temperatureC: 6.1, weatherCode: 45 },
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

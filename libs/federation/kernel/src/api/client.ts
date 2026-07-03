import createClient from 'openapi-fetch';
import type { paths } from './schema.d';

export const apiClient = createClient<paths>({
  baseUrl: '/labs/federation/api',
});

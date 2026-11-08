import type { LocappciApi } from '@/api/contract';
import { createHttpApi } from '@/api/http';
import { mockApi } from '@/api/mock/server';

/**
 * Which "kitchen" the app orders from.
 * - No EXPO_PUBLIC_API_URL set → the mock server with sample data (today).
 * - EXPO_PUBLIC_API_URL=https://api.locappci.fr → the real gateway.
 * Screens never import mock or http directly: always `api` from here.
 */
const baseUrl = process.env.EXPO_PUBLIC_API_URL;

export const api: LocappciApi = baseUrl ? createHttpApi(baseUrl) : mockApi;
export const usingMock = !baseUrl;

export * from '@/api/contract';
export { ApiError } from '@/api/errors';

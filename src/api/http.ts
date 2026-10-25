import type { ApiErrorBody, LocappciApi, ProductQuery } from '@/api/contract';
import { ApiError, networkError } from '@/api/errors';

const TIMEOUT_MS = 10_000;

/**
 * Real client: calls the gateway over HTTPS. Endpoints are listed in docs/API.md.
 * Not used until EXPO_PUBLIC_API_URL is set (see src/api/index.ts).
 */
export function createHttpApi(baseUrl: string): LocappciApi {
  async function request<T>(
    method: 'GET' | 'POST',
    path: string,
    params?: Record<string, string | number | undefined>,
    body?: unknown,
  ): Promise<T> {
    const url = new URL(path, baseUrl);
    Object.entries(params ?? {}).forEach(([k, v]) => {
      if (v !== undefined && v !== '') url.searchParams.set(k, String(v));
    });

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    let res: Response;
    try {
      res = await fetch(url.toString(), {
        method,
        headers: {
          Accept: 'application/json',
          'Accept-Language': 'fr',
          ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        },
        body: body !== undefined ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });
    } catch {
      throw networkError();
    } finally {
      clearTimeout(timer);
    }

    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as ApiErrorBody | null;
      throw new ApiError(
        body?.code ?? 'server_error',
        body?.message ?? 'Un problème est survenu. Réessayez dans un instant.',
      );
    }
    // 204 No Content (e.g. a report): nothing to read.
    if (res.status === 204) return undefined as T;
    return (await res.json()) as T;
  }

  const get = <T,>(path: string, params?: Record<string, string | number | undefined>) =>
    request<T>('GET', path, params);

  const q = (query: ProductQuery) => ({
    universe: query.universe,
    city: query.cityId,
    category: query.categoryId,
    search: query.search,
    min_price: query.minPrice,
    max_price: query.maxPrice,
    sort: query.sort,
    page: query.page,
    page_size: query.pageSize,
  });

  return {
    listCities: () => get('/v1/cities'),
    listCategories: (universe) => get('/v1/categories', { universe }),
    listProducts: (query) => get('/v1/products', q(query)),
    getProduct: (id) => get(`/v1/products/${encodeURIComponent(id)}`),
    getShop: (id) => get(`/v1/shops/${encodeURIComponent(id)}`),
    checkStock: (productId, shownPrice) =>
      get(`/v1/products/${encodeURIComponent(productId)}/stock`, { shown_price: shownPrice }),
    getRentalCalendar: (productId) => get(`/v1/products/${encodeURIComponent(productId)}/calendar`),
    checkRental: (productId, request) =>
      get(`/v1/products/${encodeURIComponent(productId)}/rental-check`, {
        start_date: request.startDate,
        days: request.days,
        shown_price_per_day: request.shownPricePerDay,
      }),
    getDeliveryOptions: (shopIds) => get('/v1/delivery-options', { shops: shopIds.join(',') }),
    createOrder: (order) => request('POST', '/v1/orders', undefined, order),
    createAccount: (req) => request('POST', '/v1/accounts', undefined, req),
    getOrder: (id) => get(`/v1/orders/${encodeURIComponent(id)}`),
    checkCart: (lines) => request('POST', '/v1/cart/check', undefined, { lines }),
    reportProduct: (productId, report) =>
      request('POST', `/v1/products/${encodeURIComponent(productId)}/reports`, undefined, report),
  };
}

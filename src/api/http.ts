import type { ApiErrorBody, LocappciApi, ProductQuery } from '@/api/contract';
import { ApiError, networkError } from '@/api/errors';

const TIMEOUT_MS = 10_000;

/**
 * Real client: calls the gateway over HTTPS. Endpoints are listed in docs/API.md.
 * Not used until EXPO_PUBLIC_API_URL is set (see src/api/index.ts).
 */
export function createHttpApi(baseUrl: string): LocappciApi {
  async function get<T>(path: string, params?: Record<string, string | number | undefined>): Promise<T> {
    const url = new URL(path, baseUrl);
    Object.entries(params ?? {}).forEach(([k, v]) => {
      if (v !== undefined && v !== '') url.searchParams.set(k, String(v));
    });

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    let res: Response;
    try {
      res = await fetch(url.toString(), {
        headers: { Accept: 'application/json', 'Accept-Language': 'fr' },
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
    return (await res.json()) as T;
  }

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
  };
}

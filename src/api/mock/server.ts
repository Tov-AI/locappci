import type {
  LocappciApi,
  Product,
  ProductQuery,
  ProductSummary,
  StockCheck,
} from '@/api/contract';
import { ApiError, networkError } from '@/api/errors';
import { categories, cities, products, shops } from '@/api/mock/data';

/**
 * Developer switches to test loading, error and offline behaviour on a real phone.
 * Changed from the "Données (dev)" screen. They only exist in the mock.
 */
export const mockSettings = {
  /** Extra delay per request, in ms. 'slow' simulates a weak 3G connection. */
  latency: 'normal' as 'fast' | 'normal' | 'slow',
  /** Every request fails as if the network were down. */
  failAll: false,
};

const delayMs = () => ({ fast: 50, normal: 400, slow: 2500 })[mockSettings.latency];

async function respond<T>(make: () => T): Promise<T> {
  await new Promise((r) => setTimeout(r, delayMs()));
  if (mockSettings.failAll) throw networkError();
  // Return a copy so screens can never change the "server" data by accident.
  return JSON.parse(JSON.stringify(make())) as T;
}

const shopName = (id: string) => shops.find((s) => s.id === id)?.name ?? '';

function toSummary(p: Product): ProductSummary {
  return {
    id: p.id,
    universe: p.universe,
    name: p.name,
    coverUrl: p.images[0] ?? null,
    price: p.universe === 'vente' ? p.price : p.pricePerDay,
    cityId: p.cityId,
    shopName: shopName(p.shopId),
    stockStatus: p.universe === 'vente' ? p.stock.status : null,
  };
}

const normalise = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

function filterProducts(q: ProductQuery): ProductSummary[] {
  const term = q.search ? normalise(q.search.trim()) : '';
  let list = products
    .filter((p) => !q.universe || p.universe === q.universe)
    .filter((p) => !q.categoryId || p.categoryId === q.categoryId || categories.find((c) => c.id === p.categoryId)?.parentId === q.categoryId)
    .filter((p) => !term || normalise(`${p.name} ${p.description}`).includes(term))
    .map(toSummary)
    .filter((s) => q.minPrice == null || s.price >= q.minPrice)
    .filter((s) => q.maxPrice == null || s.price <= q.maxPrice);

  if (q.sort === 'price_asc') list = [...list].sort((a, b) => a.price - b.price);
  // "nearest": items in the chosen commune first, then the others.
  if ((q.sort ?? 'nearest') === 'nearest' && q.cityId) {
    list = [...list].sort((a, b) => Number(b.cityId === q.cityId) - Number(a.cityId === q.cityId));
  }
  return list;
}

export const mockApi: LocappciApi = {
  listCities: () => respond(() => cities),

  listCategories: (universe) =>
    respond(() => categories.filter((c) => !universe || c.universe === universe)),

  listProducts: (query) =>
    respond(() => {
      const page = query.page ?? 1;
      const pageSize = query.pageSize ?? 20;
      const all = filterProducts(query);
      const start = (page - 1) * pageSize;
      return {
        items: all.slice(start, start + pageSize),
        page,
        pageSize,
        total: all.length,
        hasMore: start + pageSize < all.length,
      };
    }),

  getProduct: (id) =>
    respond(() => {
      const p = products.find((x) => x.id === id);
      if (!p) throw new ApiError('not_found', "Cette annonce n'est plus disponible.");
      return p;
    }),

  getShop: (id) =>
    respond(() => {
      const s = shops.find((x) => x.id === id);
      if (!s) throw new ApiError('not_found', "Cette boutique n'existe plus.");
      return s;
    }),

  checkStock: (productId, shownPrice) =>
    respond((): StockCheck => {
      const p = products.find((x) => x.id === productId);
      if (!p) throw new ApiError('not_found', "Cette annonce n'est plus disponible.");
      const price = p.universe === 'vente' ? p.price : p.pricePerDay;
      const status = p.universe === 'vente' ? p.stock.status : 'in_stock';
      return { productId, available: status !== 'out_of_stock', status, price, priceChanged: price !== shownPrice };
    }),
};

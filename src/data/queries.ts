import { useInfiniteQuery, useMutation, useQuery } from '@tanstack/react-query';

import { api, type CartCheckLine, type ProductQuery, type ProductReport, type RentalRequest, type Universe } from '@/api';

/**
 * Query keys: one name per kind of data, so the cache knows what to refresh.
 * Screens use the hooks below, never `api` directly.
 */
export const keys = {
  cities: ['cities'] as const,
  categories: (universe?: Universe) => ['categories', universe ?? 'all'] as const,
  products: (query: Omit<ProductQuery, 'page'>) => ['products', query] as const,
  product: (id: string) => ['product', id] as const,
  shop: (id: string) => ['shop', id] as const,
  rentalCalendar: (id: string) => ['rentalCalendar', id] as const,
};

const DAY = 24 * 60 * 60_000;

/** Communes rarely change: keep them fresh for a day. */
export const useCities = () =>
  useQuery({ queryKey: keys.cities, queryFn: () => api.listCities(), staleTime: DAY });

export const useCategories = (universe?: Universe) =>
  useQuery({ queryKey: keys.categories(universe), queryFn: () => api.listCategories(universe), staleTime: DAY });

/** Product list with endless scroll: 20 per page, next page loaded on demand. */
export const useProducts = (query: Omit<ProductQuery, 'page'>) =>
  useInfiniteQuery({
    queryKey: keys.products(query),
    queryFn: ({ pageParam }) => api.listProducts({ ...query, page: pageParam }),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.hasMore ? last.page + 1 : undefined),
  });

export const useProduct = (id: string) =>
  useQuery({ queryKey: keys.product(id), queryFn: () => api.getProduct(id) });

export const useShop = (id: string | undefined) =>
  useQuery({ queryKey: keys.shop(id ?? ''), queryFn: () => api.getShop(id!), enabled: !!id });

/**
 * Live stock and price check before "Ajouter au panier" and before payment.
 * A mutation, not a cached query: the answer must always come from the server.
 */
export const useStockCheck = () =>
  useMutation({
    mutationFn: ({ productId, shownPrice }: { productId: string; shownPrice: number }) =>
      api.checkStock(productId, shownPrice),
    networkMode: 'online',
  });

/**
 * Number of results for a set of filters, without downloading the products.
 * Used by "Afficher N résultats" in the Filtres sheet.
 */
export const useProductCount = (query: Omit<ProductQuery, 'page' | 'pageSize'>, enabled = true) =>
  useQuery({
    queryKey: ['productCount', query],
    queryFn: async () => (await api.listProducts({ ...query, page: 1, pageSize: 1 })).total,
    enabled,
    placeholderData: (previous) => previous,
  });

/** Up to 6 other products from the same category, for "Articles similaires". */
export const useSimilarProducts = (productId: string, universe: Universe | undefined, categoryId: string | undefined) =>
  useQuery({
    queryKey: ['similar', productId],
    queryFn: async () => {
      const page = await api.listProducts({ universe, categoryId, page: 1, pageSize: 7 });
      return page.items.filter((p) => p.id !== productId).slice(0, 6);
    },
    enabled: !!categoryId,
  });

/** "Signaler cette annonce". Needs the network: never queued silently. */
export const useReportProduct = () =>
  useMutation({
    mutationFn: ({ productId, report }: { productId: string; report: ProductReport }) =>
      api.reportProduct(productId, report),
    networkMode: 'online',
  });

/** Booked days of a rental item. Short freshness: bookings change during the day. */
export const useRentalCalendar = (productId: string) =>
  useQuery({
    queryKey: keys.rentalCalendar(productId),
    queryFn: () => api.getRentalCalendar(productId),
    staleTime: 60_000,
  });

/** Live availability and price check before "Réserver". Like the stock check: never cached. */
export const useRentalCheck = () =>
  useMutation({
    mutationFn: ({ productId, request }: { productId: string; request: RentalRequest }) =>
      api.checkRental(productId, request),
    networkMode: 'online',
  });

/** Live check of the whole cart before payment (stock, dates, prices). Never cached. */
export const useCartCheck = () =>
  useMutation({
    mutationFn: (lines: CartCheckLine[]) => api.checkCart(lines),
    networkMode: 'online',
  });

import { useInfiniteQuery, useMutation, useQuery } from '@tanstack/react-query';

import { api, type ProductQuery, type Universe } from '@/api';

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

import { useQuery } from '@tanstack/react-query';

import { api, type SellerProduct } from '@/api';

/** « Mes articles » of the signed-in seller (always asked again: LOCAPPCI may have validated one meanwhile). */
export const sellerProductsKey = ['sellerProducts'] as const;

export const useSellerProducts = (enabled = true) =>
  useQuery({
    queryKey: sellerProductsKey,
    queryFn: () => api.listSellerProducts(),
    staleTime: 0,
    enabled,
  });

export const SELLER_STATUS: Record<
  SellerProduct['status'],
  { label: string; tone: 'orange' | 'green' | 'navy' | 'neutral' }
> = {
  pending: { label: 'En vérification', tone: 'orange' },
  approved: { label: 'En ligne', tone: 'green' },
  refused: { label: 'Refusé', tone: 'neutral' },
  hidden: { label: 'Masqué', tone: 'neutral' },
};

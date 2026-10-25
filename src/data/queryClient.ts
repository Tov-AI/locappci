import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import { QueryClient } from '@tanstack/react-query';

import { ApiError } from '@/api/errors';
import { storage, storageKeys } from '@/data/storage';

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

/**
 * Caching rules from the design brief:
 * - Lists are fresh for 5 minutes, then refreshed in the background.
 * - Everything stays on the phone for 24 hours so screens open instantly, even offline.
 * - Network errors retry twice; "not found" never retries.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * MINUTE,
      gcTime: 24 * HOUR,
      retry: (failures, error) =>
        failures < 2 && (!(error instanceof ApiError) || error.retryable),
      networkMode: 'offlineFirst',
    },
  },
});

/** Saves the cache to the phone (at most once per second) and restores it at launch. */
export const queryPersister = createAsyncStoragePersister({
  storage,
  key: storageKeys.queryCache,
  throttleTime: 1000,
});

export const persistOptions = {
  persister: queryPersister,
  maxAge: 24 * HOUR,
  // Change this when the contract changes shape, so old cached data is thrown away.
  buster: 'contract-v2', // v2: ProductSummary gained categoryId
};

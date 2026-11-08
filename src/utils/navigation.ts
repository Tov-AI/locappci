import { useRouter } from 'expo-router';

/** Back to the previous screen; to Accueil when the screen was opened from a link with no history. */
export function useGoBack() {
  const router = useRouter();
  return () => (router.canGoBack() ? router.back() : router.replace('/'));
}

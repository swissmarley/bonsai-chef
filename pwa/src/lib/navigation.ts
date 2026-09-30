import { House, Leaf, Sun, TreeDeciduous, type LucideIcon } from 'lucide-react';
import { useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router';

export type TabView = 'tutti' | 'esterno' | 'interno' | 'strumenti';

/** The four tabs of the iOS TabView (same icons: tree, sun, house, leaf). */
export const TABS: readonly { view: TabView; path: string; label: string; title: string; icon: LucideIcon }[] = [
  { view: 'tutti', path: '/tutti', label: 'Tutti', title: 'Tutti', icon: TreeDeciduous },
  { view: 'esterno', path: '/esterno', label: 'Esterno', title: 'Bonsai Esterno', icon: Sun },
  { view: 'interno', path: '/interno', label: 'Interno', title: 'Bonsai Interno', icon: House },
  { view: 'strumenti', path: '/strumenti', label: 'Strumenti', title: 'Strumenti & Altro', icon: Leaf },
];

const LAST_TAB_KEY = 'bc:lastTab';

export function rememberTab(path: string) {
  try {
    sessionStorage.setItem(LAST_TAB_KEY, path);
  } catch {
    // storage unavailable (private mode): the default tab is fine
  }
}

export function lastTab(): string {
  try {
    return sessionStorage.getItem(LAST_TAB_KEY) ?? '/tutti';
  } catch {
    return '/tutti';
  }
}

/** Go back in the app's history, or to `fallback` when the page was opened directly. */
export function useGoBack() {
  const navigate = useNavigate();
  const location = useLocation();
  return useCallback(
    (fallback: string) => {
      if (location.key !== 'default') navigate(-1);
      else navigate(fallback, { replace: true });
    },
    [navigate, location.key],
  );
}

import { useSyncExternalStore } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

// Chrome/Edge/Android fire this once, early: keep it so the Account sheet can offer "Installa l'app".
let deferred: BeforeInstallPromptEvent | null = null;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferred = e as BeforeInstallPromptEvent;
  notify();
});
window.addEventListener('appinstalled', () => {
  deferred = null;
  notify();
});

/** Returns a function that shows the browser's install dialog, or null when not available. */
export function useInstallPrompt(): (() => Promise<void>) | null {
  const event = useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => deferred,
  );
  if (!event) return null;
  return async () => {
    await event.prompt();
    await event.userChoice;
    deferred = null;
    notify();
  };
}

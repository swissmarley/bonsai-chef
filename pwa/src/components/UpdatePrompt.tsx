import { X } from 'lucide-react';
import { useRegisterSW } from 'virtual:pwa-register/react';

const HOUR = 60 * 60 * 1000;

/** Offers to reload when a new version of the app has been downloaded in the background. */
export function UpdatePrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_url, registration) {
      if (registration) setInterval(() => void registration.update(), HOUR);
    },
  });

  if (!needRefresh) return null;
  return (
    <div className="update-banner" role="status">
      <span>È disponibile una nuova versione di Bonsai Chef.</span>
      <button type="button" className="btn btn-primary btn-small" onClick={() => void updateServiceWorker(true)}>
        Aggiorna
      </button>
      <button type="button" className="icon-button" aria-label="Chiudi" onClick={() => setNeedRefresh(false)}>
        <X size={18} aria-hidden="true" />
      </button>
    </div>
  );
}

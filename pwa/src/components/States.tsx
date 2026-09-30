import { CircleAlert, LoaderCircle, WifiOff, type LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { ApiError } from '../lib/api';

export function Spinner({ label = 'Caricamento…', size = 20 }: { label?: string; size?: number }) {
  return (
    <span className="spinner" role="status">
      <LoaderCircle size={size} aria-hidden="true" />
      <span className="visually-hidden">{label}</span>
    </span>
  );
}

export function PageSpinner() {
  return (
    <div className="page-state">
      <Spinner size={28} />
    </div>
  );
}

export function EmptyState({ icon: Icon, title, text, children }: { icon: LucideIcon; title: string; text?: string; children?: ReactNode }) {
  return (
    <div className="page-state">
      <div className="page-state-icon">
        <Icon size={34} aria-hidden="true" />
      </div>
      <h2>{title}</h2>
      {text && <p>{text}</p>}
      {children && <div className="page-state-actions">{children}</div>}
    </div>
  );
}

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const offline = error instanceof ApiError && error.status === 0;
  return (
    <EmptyState
      icon={offline ? WifiOff : CircleAlert}
      title={offline ? 'Nessuna connessione' : 'Qualcosa è andato storto'}
      text={error instanceof Error ? error.message : 'Errore imprevisto.'}
    >
      {onRetry && (
        <button type="button" className="btn btn-secondary" onClick={onRetry}>
          Riprova
        </button>
      )}
    </EmptyState>
  );
}

/** Same artwork as the iOS launch screen, shown while the session is checked. */
export function Splash() {
  return (
    <div className="splash">
      <img src="/launch.png" alt="Bonsai Chef" width={400} height={552} className="launch-art" />
    </div>
  );
}

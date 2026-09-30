import { useId, useLayoutEffect, useRef, type ReactNode } from 'react';
import { Spinner } from './States';

let openDialogs = 0;

/** Native modal <dialog>: focus trap, Esc and backdrop close. Mount it to open, unmount to close. */
export function Dialog({
  title,
  onClose,
  children,
  variant = 'sheet',
  className = '',
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  variant?: 'sheet' | 'alert' | 'viewer';
  className?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  // Layout effect: the dialog must be open (and measurable) before children's effects run.
  useLayoutEffect(() => {
    const dialog = ref.current!;
    if (!dialog.open) dialog.showModal();
    openDialogs++;
    document.documentElement.classList.add('has-modal');
    return () => {
      if (--openDialogs === 0) document.documentElement.classList.remove('has-modal');
      if (dialog.open) dialog.close();
    };
  }, []);

  return (
    <dialog
      ref={ref}
      className={`dialog dialog-${variant} ${className}`}
      aria-labelledby={titleId}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="dialog-body">
        <h2 id={titleId} className={variant === 'viewer' ? 'visually-hidden' : 'dialog-title'}>
          {title}
        </h2>
        {children}
      </div>
    </dialog>
  );
}

export function ConfirmDialog({
  title,
  message,
  confirmLabel = 'Elimina',
  destructive = true,
  busy = false,
  error,
  onConfirm,
  onCancel,
}: {
  title: string;
  message?: ReactNode;
  confirmLabel?: string;
  destructive?: boolean;
  busy?: boolean;
  error?: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <Dialog title={title} onClose={busy ? () => {} : onCancel} variant="alert">
      {message && <p className="alert-message">{message}</p>}
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <div className="alert-actions">
        <button type="button" className="btn btn-secondary" onClick={onCancel} disabled={busy}>
          Annulla
        </button>
        <button
          type="button"
          className={`btn ${destructive ? 'btn-danger' : 'btn-primary'}`}
          onClick={onConfirm}
          disabled={busy}
          autoFocus
        >
          {busy ? <Spinner label="Attendere…" /> : confirmLabel}
        </button>
      </div>
    </Dialog>
  );
}

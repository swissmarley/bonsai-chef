import { useEffect, useRef } from 'react';
import { useBlocker } from 'react-router';
import { ConfirmDialog } from '../components/Dialog';

/** Asks before leaving a form with unsaved changes (in-app navigation and closing the tab). */
export function useUnsavedGuard(dirty: boolean) {
  const done = useRef(false);
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) => dirty && !done.current && currentLocation.pathname !== nextLocation.pathname,
  );

  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!done.current) e.preventDefault();
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [dirty]);

  const dialog =
    blocker.state === 'blocked' ? (
      <ConfirmDialog
        title="Scartare le modifiche?"
        message="Le modifiche non salvate andranno perse."
        confirmLabel="Scarta"
        onConfirm={() => blocker.proceed()}
        onCancel={() => blocker.reset()}
      />
    ) : null;

  /** Call right before navigating away after a successful save or delete. */
  const release = () => {
    done.current = true;
  };

  return { dialog, release };
}

import { useEffect, useId, useState, type FormEvent } from 'react';
import type { Bonsai } from '../../shared/model';
import { formatDateTime, toLocalInputValue } from '../lib/format';
import { enablePush, getPushState, type PushState } from '../lib/push';
import { useCreateReminder } from '../lib/queries';
import { Dialog } from './Dialog';
import { Spinner } from './States';
import { useToast } from './Toast';

const HINTS: Record<PushState, string> = {
  on: '🔔 Riceverai una notifica su questo dispositivo.',
  off: "Salvando ti chiederemo il permesso di inviarti notifiche. Se non lo concedi, riceverai un'email.",
  denied: 'Le notifiche sono bloccate in questo browser: riceverai il promemoria via email.',
  'ios-needs-install': "Per le notifiche su iPhone aggiungi l'app alla schermata Home. Nel frattempo riceverai il promemoria via email.",
  unsupported: 'Riceverai il promemoria via email.',
};

function tomorrowAtNine(): Date {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(9, 0, 0, 0);
  return d;
}

/** "Imposta promemoria" from the iOS app: a message and a date/time for one bonsai. */
export function ReminderSheet({ bonsai, onClose }: { bonsai: Bonsai; onClose: () => void }) {
  const create = useCreateReminder();
  const toast = useToast();
  const id = useId();
  const [message, setMessage] = useState('');
  const [when, setWhen] = useState(() => toLocalInputValue(tomorrowAtNine()));
  const [push, setPush] = useState<PushState | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    getPushState().then(setPush, () => setPush('unsupported'));
  }, []);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError('');
    const date = new Date(when);
    if (!when || Number.isNaN(date.getTime())) return setError('Inserisci data e ora del promemoria.');
    if (date.getTime() <= Date.now()) return setError('Scegli una data e un’ora nel futuro.');

    // Ask for notification permission first, while we are still inside the user's tap.
    let pushProblem = '';
    if (push === 'off') {
      try {
        await enablePush();
      } catch (err) {
        pushProblem = err instanceof Error ? err.message : '';
      }
    }
    try {
      await create.mutateAsync({ bonsaiId: bonsai.id, message: message.trim(), remindAt: date.toISOString() });
    } catch (err) {
      return setError(err instanceof Error ? err.message : 'Salvataggio non riuscito.');
    }
    toast(`Promemoria impostato per ${formatDateTime(date.toISOString())}.`, 'success');
    if (pushProblem) toast(`${pushProblem} Riceverai il promemoria via email.`);
    onClose();
  }

  return (
    <Dialog title="Imposta promemoria" onClose={onClose}>
      <form onSubmit={submit} className="stack">
        <p className="sheet-text">
          Per <strong>{bonsai.name}</strong>
        </p>
        <div className="field">
          <label className="field-label" htmlFor={`${id}-msg`}>
            Messaggio
          </label>
          <input
            id={`${id}-msg`}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Messaggio di promemoria"
            maxLength={500}
            autoFocus
          />
        </div>
        <div className="field">
          <label className="field-label" htmlFor={`${id}-when`}>
            Data e ora
          </label>
          <input
            id={`${id}-when`}
            type="datetime-local"
            value={when}
            min={toLocalInputValue(new Date())}
            onChange={(e) => setWhen(e.target.value)}
            required
          />
        </div>
        {push && <p className="sheet-hint">{HINTS[push]}</p>}
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <div className="alert-actions">
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={create.isPending}>
            Annulla
          </button>
          <button type="submit" className="btn btn-primary" disabled={create.isPending}>
            {create.isPending ? <Spinner label="Salvataggio…" /> : 'Salva'}
          </button>
        </div>
      </form>
    </Dialog>
  );
}

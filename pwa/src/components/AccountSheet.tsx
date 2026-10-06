import { useQueryClient } from '@tanstack/react-query';
import { BellRing, ChevronRight, Download, Info, LogOut, Share } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { api } from '../lib/api';
import { useInstallPrompt } from '../lib/install';
import { disablePush, enablePush, getPushState, isIos, isStandalone, type PushState } from '../lib/push';
import { clearUserData, useMe } from '../lib/queries';
import { Dialog } from './Dialog';
import { Spinner } from './States';
import { useToast } from './Toast';

const PUSH_TEXT: Record<PushState, string> = {
  on: 'Attive su questo dispositivo: riceverai qui i promemoria.',
  off: 'Non attive su questo dispositivo: i promemoria ti arriveranno via email.',
  denied: 'Bloccate nelle impostazioni del browser: i promemoria ti arriveranno via email.',
  'ios-needs-install': "Su iPhone e iPad le notifiche funzionano dopo aver aggiunto l'app alla schermata Home. Fino ad allora i promemoria ti arriveranno via email.",
  unsupported: 'Questo browser non supporta le notifiche: i promemoria ti arriveranno via email.',
};

export function AccountSheet({ onClose }: { onClose: () => void }) {
  const { data: user } = useMe();
  const qc = useQueryClient();
  const toast = useToast();
  const install = useInstallPrompt();
  const [push, setPush] = useState<PushState | null>(null);
  const [busy, setBusy] = useState<'push' | 'test' | 'logout' | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    getPushState().then(setPush, () => setPush('unsupported'));
  }, []);

  async function run(kind: 'push' | 'test' | 'logout', task: () => Promise<void>) {
    setBusy(kind);
    setError('');
    try {
      await task();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Operazione non riuscita.');
    } finally {
      setBusy(null);
    }
  }

  const togglePush = () =>
    run('push', async () => {
      if (push === 'on') await disablePush();
      else await enablePush();
      setPush(await getPushState());
    });

  const testPush = () =>
    run('test', async () => {
      await api.pushTest();
      toast('Notifica di prova inviata.', 'success');
    });

  const logout = () =>
    run('logout', async () => {
      await disablePush().catch(() => {}); // this device should stop receiving the reminders of this account
      await api.logout();
      await clearUserData(qc);
    });

  return (
    <Dialog title="Account" onClose={onClose}>
      <p className="account-email">
        Accesso effettuato come
        <br />
        <strong>{user?.email}</strong>
      </p>

      <div className="sheet-group">
        <h3 className="sheet-group-title">
          <BellRing size={18} aria-hidden="true" /> Notifiche
        </h3>
        <p className="sheet-text">{push ? PUSH_TEXT[push] : <Spinner />}</p>
        {(push === 'on' || push === 'off') && (
          <div className="sheet-actions">
            <button type="button" className="btn btn-secondary" onClick={togglePush} disabled={busy !== null}>
              {busy === 'push' ? <Spinner /> : push === 'on' ? 'Disattiva notifiche' : 'Attiva notifiche'}
            </button>
            {push === 'on' && (
              <button type="button" className="btn btn-secondary" onClick={testPush} disabled={busy !== null}>
                {busy === 'test' ? <Spinner /> : 'Invia notifica di prova'}
              </button>
            )}
          </div>
        )}
      </div>

      {!isStandalone() && (install || isIos()) && (
        <div className="sheet-group">
          <h3 className="sheet-group-title">
            <Download size={18} aria-hidden="true" /> Installa l'app
          </h3>
          {install ? (
            <button type="button" className="btn btn-secondary" onClick={() => void install()}>
              Installa Bonsai Chef
            </button>
          ) : (
            <p className="sheet-text">
              In Safari tocca <Share size={15} aria-label="Condividi" className="inline-icon" /> e poi «Aggiungi alla schermata Home».
            </p>
          )}
        </div>
      )}

      <Link to="/info" className="action-item">
        <Info size={22} aria-hidden="true" /> <span className="action-item-label">Informazioni e contatti</span>
        <ChevronRight size={18} className="row-chevron" aria-hidden="true" />
      </Link>

      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}

      <button type="button" className="btn btn-danger-outline btn-block" onClick={logout} disabled={busy !== null}>
        {busy === 'logout' ? (
          <Spinner label="Uscita in corso…" />
        ) : (
          <>
            <LogOut size={18} aria-hidden="true" /> Esci
          </>
        )}
      </button>
      <button type="button" className="btn btn-plain btn-block" onClick={onClose}>
        Chiudi
      </button>
    </Dialog>
  );
}

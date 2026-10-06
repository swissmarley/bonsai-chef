import { BellRing, ClipboardList, FlaskConical, Folders, Mail, Users, type LucideIcon } from 'lucide-react';
import { useEffect, useState } from 'react';
import { CURRENT_ANNOUNCEMENT } from '../../shared/model';
import { useBonsaiList, useMarkAnnouncementSeen, useMe, useSeenAnnouncements, useToolList } from '../lib/queries';
import { Dialog } from './Dialog';

const NEWS: { icon: LucideIcon; title: string; text: string }[] = [
  { icon: Folders, title: 'Gruppi', text: 'Raccogli i bonsai in gruppi, per esempio «Pini» o «Aceri»: li trovi in fondo all’elenco, in «Gestisci gruppi».' },
  {
    icon: ClipboardList,
    title: 'Storico degli interventi',
    text: 'Registra ogni rinvaso, concimazione, potatura… con la data, la miscela o il concime usato, note e foto: nel tempo vedrai come risponde la pianta.',
  },
  {
    icon: BellRing,
    title: 'Frequenza e promemoria',
    text: 'Indica ogni quanto fai un intervento: vedrai quando tocca il prossimo e, se vuoi, riceverai un promemoria.',
  },
  { icon: Users, title: 'Un intervento per tutto il gruppo', text: 'Hai concimato tutti i pini? Registralo una volta sola.' },
  { icon: FlaskConical, title: 'Concimi', text: 'Nuova categoria in Strumenti, da collegare agli interventi insieme ai substrati.' },
  { icon: Mail, title: 'Info e contatti', text: 'Scrivimi direttamente dall’app: Account → Informazioni e contatti.' },
];

const storageKey = (userId: string) => `bc:seen:${CURRENT_ANNOUNCEMENT}:${userId}`;

function seenOnDevice(userId: string): boolean {
  try {
    return localStorage.getItem(storageKey(userId)) === '1';
  } catch {
    return false;
  }
}

function rememberOnDevice(userId: string) {
  try {
    localStorage.setItem(storageKey(userId), '1');
  } catch {
    // the server copy is what counts
  }
}

/**
 * "Novità" of this release, shown once per account: closing it in any way saves it as seen on the
 * server (every device) and on this device (in case that save fails). New accounts, with nothing
 * saved yet, skip it.
 */
export function WhatsNew() {
  const me = useMe();
  const seen = useSeenAnnouncements();
  const bonsai = useBonsaiList();
  const tools = useToolList();
  const mark = useMarkAnnouncementSeen();
  const userId = me.data?.id ?? '';
  const [closed, setClosed] = useState(() => !userId || seenOnDevice(userId));

  const pending = !closed && seen.isSuccess && !seen.data.includes(CURRENT_ANNOUNCEMENT) && bonsai.isSuccess && tools.isSuccess;
  const hasData = (bonsai.data?.length ?? 0) + (tools.data?.length ?? 0) > 0;

  function dismiss() {
    setClosed(true);
    rememberOnDevice(userId);
    mark.mutate(CURRENT_ANNOUNCEMENT);
  }

  useEffect(() => {
    if (pending && !hasData) dismiss(); // a new account: nothing was "updated" for them
  }, [pending, hasData]);

  if (!pending || !hasData) return null;
  return (
    <Dialog title="Novità in Bonsai Chef" onClose={dismiss}>
      <p className="sheet-text sheet-intro">Grazie ai vostri suggerimenti, Bonsai Chef si è arricchita di nuove funzioni:</p>
      <ul className="news-list">
        {NEWS.map(({ icon: Icon, title, text }) => (
          <li key={title}>
            <Icon size={22} aria-hidden="true" />
            <span>
              <strong>{title}</strong>
              {text}
            </span>
          </li>
        ))}
      </ul>
      <p className="sheet-hint">Tutto ciò che avevi già salvato è rimasto com’era.</p>
      <button type="button" className="btn btn-primary btn-block news-ok" onClick={dismiss} autoFocus>
        Ho capito
      </button>
    </Dialog>
  );
}

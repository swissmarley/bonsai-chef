import { Heart, Info, Mail, ShieldAlert, Sprout } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { PageHeader } from '../components/PageHeader';
import { Spinner } from '../components/States';
import { useToast } from '../components/Toast';
import { api } from '../lib/api';
import { lastTab } from '../lib/navigation';
import { useMe } from '../lib/queries';

/** "Informazioni": the app, its developer, a contact form and the disclaimer. Also reachable when signed out. */
export function InfoPage() {
  const me = useMe();
  return (
    <div className="app is-form">
      <main className="app-main">
        <PageHeader title="Informazioni" back={me.data ? lastTab() : '/'} />
        <div className="page-content info-page">
          <img src="/launch.png" alt="Bonsai Chef" width={400} height={552} className="launch-art info-art" />
          <p className="info-version">Versione {__APP_VERSION__}</p>

          <section className="section">
            <h2 className="section-title">
              <Sprout size={14} aria-hidden="true" className="inline-icon" /> L’app
            </h2>
            <div className="card card-text">
              <p>
                Bonsai Chef è il diario per la cura dei tuoi bonsai: schede di coltivazione, storico degli interventi, gruppi, strumenti e
                promemoria, sempre a portata di mano.
              </p>
            </div>
          </section>

          <section className="section">
            <h2 className="section-title">
              <Heart size={14} aria-hidden="true" className="inline-icon" /> Chi sono
            </h2>
            <div className="card card-text">
              <p>Ciao! Sono Nakya e ho sviluppato Bonsai Chef.</p>
              <p>
                L’ho creata con passione, per un gruppo di amici che condividono l’amore per i bonsai, ed è cresciuta grazie ai vostri
                suggerimenti.
              </p>
              <p>
                Vi ringrazio di cuore per usarla ogni giorno: ogni pianta che registrate e ogni consiglio che mi mandate mi aiutano a
                migliorarla.
              </p>
            </div>
          </section>

          <section className="section">
            <h2 className="section-title">
              <Info size={14} aria-hidden="true" className="inline-icon" /> Gratuita e senza scopo di lucro
            </h2>
            <div className="card card-text">
              <p>
                Bonsai Chef è gratuita e senza scopo di lucro: niente pubblicità, niente abbonamenti. È un progetto nato per passione, da
                condividere con gli amici.
              </p>
            </div>
          </section>

          <section className="section">
            <h2 className="section-title">
              <Mail size={14} aria-hidden="true" className="inline-icon" /> Contatti
            </h2>
            <div className="card">{me.data ? <ContactForm /> : <p className="card-text muted">Accedi all’app per scrivermi da qui.</p>}</div>
          </section>

          <section className="section">
            <h2 className="section-title">
              <ShieldAlert size={14} aria-hidden="true" className="inline-icon" /> Avvertenze
            </h2>
            <div className="card card-text">
              <p>
                Bonsai Chef è offerta così com’è, senza garanzie. Non mi assumo alcuna responsabilità per i dati inseriti nell’app, per la
                loro correttezza o per l’uso che se ne fa: ognuno resta responsabile delle informazioni che inserisce e delle scelte di
                cura delle proprie piante.
              </p>
              <p>Ti consiglio di conservare anche altrove le informazioni a cui tieni di più.</p>
            </div>
          </section>

          <p className="info-credit">Creato da Nakya</p>
        </div>
      </main>
    </div>
  );
}

function ContactForm() {
  const toast = useToast();
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!message.trim()) return;
    setBusy(true);
    setError('');
    try {
      await api.sendFeedback(message.trim());
      setMessage('');
      toast('Messaggio inviato. Grazie! Ti risponderò via email.', 'success');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invio non riuscito.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="contact-form">
      <p className="card-text">Hai un’idea, un problema o un consiglio? Scrivimi: ti risponderò alla tua email.</p>
      <div className="field">
        <label className="visually-hidden" htmlFor="contact-message">
          Messaggio
        </label>
        <textarea
          id="contact-message"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Scrivi qui il tuo messaggio…"
          rows={5}
          maxLength={5000}
        />
      </div>
      {error && (
        <p className="form-error contact-error" role="alert">
          {error}
        </p>
      )}
      <div className="card-actions">
        <button type="submit" className="btn btn-primary btn-small" disabled={busy || !message.trim()}>
          {busy ? <Spinner label="Invio in corso…" /> : 'Invia messaggio'}
        </button>
      </div>
    </form>
  );
}

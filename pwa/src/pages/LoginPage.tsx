import { useQueryClient } from '@tanstack/react-query';
import { Mail } from 'lucide-react';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import { Spinner } from '../components/States';
import { api } from '../lib/api';
import { startSession } from '../lib/queries';

const LAST_EMAIL_KEY = 'bc:lastEmail';

function storedEmail(): string {
  try {
    return localStorage.getItem(LAST_EMAIL_KEY) ?? '';
  } catch {
    return '';
  }
}

export function LoginPage() {
  const qc = useQueryClient();
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [email, setEmail] = useState(storedEmail);
  const [code, setCode] = useState('');
  const [minutes, setMinutes] = useState(10);
  const [cooldown, setCooldown] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const codeInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  async function sendCode(e?: FormEvent) {
    e?.preventDefault();
    setBusy(true);
    setError('');
    try {
      const res = await api.requestCode(email);
      try {
        localStorage.setItem(LAST_EMAIL_KEY, email.trim().toLowerCase());
      } catch {
        // not important
      }
      setMinutes(res.expiresInMinutes);
      setCooldown(res.resendAfterSeconds);
      setCode('');
      setStep('code');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invio non riuscito.');
    } finally {
      setBusy(false);
    }
  }

  async function verify(value: string) {
    setBusy(true);
    setError('');
    try {
      const user = await api.verifyCode(email, value);
      await startSession(qc, user);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Accesso non riuscito.');
      setCode('');
      setBusy(false);
      requestAnimationFrame(() => codeInput.current?.focus());
    }
  }

  function onCodeChange(raw: string) {
    const digits = raw.replace(/\D/g, '').slice(0, 6);
    setCode(digits);
    if (digits.length === 6 && !busy) void verify(digits);
  }

  return (
    <main className="login">
      <img src="/launch.png" alt="Bonsai Chef" width={400} height={552} className="launch-art login-art" />
      <div className="login-card">
        {step === 'email' ? (
          <form onSubmit={sendCode} className="stack">
            <h1>Accedi</h1>
            <p className="login-text">Inserisci la tua email: ti invieremo un codice per accedere, senza bisogno di password.</p>
            <div className="field">
              <label className="field-label" htmlFor="login-email">
                Email
              </label>
              <input
                id="login-email"
                type="email"
                inputMode="email"
                autoComplete="email"
                autoCapitalize="none"
                spellCheck={false}
                placeholder="nome@esempio.it"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoFocus={!email}
              />
            </div>
            {error && (
              <p className="form-error" role="alert">
                {error}
              </p>
            )}
            <button type="submit" className="btn btn-primary btn-block" disabled={busy || !email.trim()}>
              {busy ? <Spinner label="Invio in corso…" /> : 'Invia codice'}
            </button>
          </form>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (code.length === 6) void verify(code);
            }}
            className="stack"
          >
            <h1>Controlla la tua email</h1>
            <p className="login-text">
              <Mail size={16} aria-hidden="true" className="inline-icon" /> Abbiamo inviato un codice di 6 cifre a <strong>{email}</strong>. Scade
              tra {minutes} minuti.
            </p>
            <input
              ref={codeInput}
              className="otp-input"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]*"
              maxLength={6}
              placeholder="••••••"
              aria-label="Codice di accesso"
              value={code}
              onChange={(e) => onCodeChange(e.target.value)}
              disabled={busy}
              autoFocus
            />
            {error && (
              <p className="form-error" role="alert">
                {error}
              </p>
            )}
            <button type="submit" className="btn btn-primary btn-block" disabled={busy || code.length !== 6}>
              {busy ? <Spinner label="Verifica in corso…" /> : 'Accedi'}
            </button>
            <div className="login-links">
              <button type="button" className="link-button" onClick={() => void sendCode()} disabled={busy || cooldown > 0}>
                {cooldown > 0 ? `Invia di nuovo tra ${cooldown} s` : 'Invia di nuovo il codice'}
              </button>
              <button
                type="button"
                className="link-button"
                onClick={() => {
                  setStep('email');
                  setError('');
                }}
                disabled={busy}
              >
                Cambia email
              </button>
            </div>
          </form>
        )}
      </div>
      <Link to="/info" className="login-credit">
        Creato da Nakya
      </Link>
    </main>
  );
}

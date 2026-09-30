import { HttpError } from './http';

interface Email {
  to: string;
  subject: string;
  text: string;
  html: string;
}

/** True under `netlify dev` / `netlify serve` on this machine, never on deployed sites. */
export const isDev = () => process.env.NETLIFY_DEV === 'true' || process.env.NETLIFY_LOCAL === 'true';

/** Sends an e-mail with Resend. In local development without an API key it is printed to the terminal. */
export async function sendEmail(email: Email): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    if (isDev()) {
      console.log(`\n──── 📧 Email (sviluppo) ────\nA: ${email.to}\nOggetto: ${email.subject}\n\n${email.text}\n────────────────────────────\n`);
      return;
    }
    throw new HttpError(500, "L'invio delle email non è configurato sul server.");
  }

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: process.env.EMAIL_FROM || 'Bonsai Chef <onboarding@resend.dev>',
      to: [email.to],
      subject: email.subject,
      text: email.text,
      html: email.html,
    }),
  });
  if (!res.ok) {
    console.error('[email] Resend error', res.status, await res.text().catch(() => ''));
    throw new HttpError(502, "Impossibile inviare l'email in questo momento. Riprova tra poco.");
  }
}

const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

function layout(title: string, body: string): string {
  return `<!doctype html><html lang="it"><body style="margin:0;background:#f2f2f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#1c1c1e">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="100%" style="max-width:440px;background:#ffffff;border-radius:16px;padding:32px" cellpadding="0" cellspacing="0"><tr><td>
<p style="margin:0 0 4px;font-size:13px;letter-spacing:.08em;text-transform:uppercase;color:#3f6f1c;font-weight:600">Bonsai Chef</p>
<h1 style="margin:0 0 16px;font-size:22px">${escapeHtml(title)}</h1>
${body}
</td></tr></table></td></tr></table></body></html>`;
}

export function loginCodeEmail(to: string, code: string, ttlMinutes: number): Email {
  return {
    to,
    subject: `${code} è il tuo codice di accesso a Bonsai Chef`,
    text: `Il tuo codice di accesso a Bonsai Chef è: ${code}\n\nIl codice scade tra ${ttlMinutes} minuti. Se non hai richiesto tu l'accesso, ignora questa email.`,
    html: layout(
      'Il tuo codice di accesso',
      `<p style="margin:0 0 20px;font-size:16px;line-height:1.5">Inserisci questo codice nell'app per accedere:</p>
<p style="margin:0 0 20px;font-size:36px;font-weight:700;letter-spacing:.3em;color:#3f6f1c">${code}</p>
<p style="margin:0;font-size:14px;line-height:1.5;color:#6b6b70">Il codice scade tra ${ttlMinutes} minuti. Se non hai richiesto tu l'accesso, ignora questa email.</p>`,
    ),
  };
}

export function reminderEmail(to: string, bonsaiName: string, message: string, link: string): Email {
  const body = message || `È il momento di occuparti di ${bonsaiName}.`;
  return {
    to,
    subject: `Promemoria Bonsai Chef: ${bonsaiName}`,
    text: `${body}\n\nApri ${bonsaiName}: ${link}`,
    html: layout(
      `Promemoria: ${bonsaiName}`,
      `<p style="margin:0 0 24px;font-size:16px;line-height:1.5">${escapeHtml(body)}</p>
<a href="${escapeHtml(link)}" style="display:inline-block;background:#3f6f1c;color:#ffffff;text-decoration:none;padding:12px 20px;border-radius:10px;font-weight:600">Apri ${escapeHtml(bonsaiName)}</a>`,
    ),
  };
}

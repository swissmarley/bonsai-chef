const dateFormat = new Intl.DateTimeFormat('it-IT', { day: 'numeric', month: 'long', year: 'numeric' });
const dateTimeFormat = new Intl.DateTimeFormat('it-IT', {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

/** "2025-03-15" → "15 marzo 2025" (parsed as a local date, not UTC). */
export function formatDate(isoDate: string | null | undefined): string {
  if (!isoDate) return '';
  const [y, m, d] = isoDate.split('-').map(Number);
  return dateFormat.format(new Date(y, m - 1, d));
}

export const formatDateTime = (iso: string) => dateTimeFormat.format(new Date(iso));

/** Value for <input type="datetime-local"> in the user's time zone. */
export function toLocalInputValue(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export type TextPart = { type: 'text'; value: string } | { type: 'link'; value: string; href: string };

const URL_RE = /\b((?:https?:\/\/|www\.)[^\s<>"']+[^\s<>"'.,;:!?)\]])/gi;

/** Splits free text into plain parts and clickable links (http(s) and www. addresses). */
export function linkify(text: string): TextPart[] {
  const parts: TextPart[] = [];
  let last = 0;
  for (const match of text.matchAll(URL_RE)) {
    const start = match.index ?? 0;
    if (start > last) parts.push({ type: 'text', value: text.slice(last, start) });
    const value = match[0];
    parts.push({ type: 'link', value, href: value.startsWith('www.') ? `https://${value}` : value });
    last = start + value.length;
  }
  if (last < text.length) parts.push({ type: 'text', value: text.slice(last) });
  return parts;
}

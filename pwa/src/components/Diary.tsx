import { ChevronRight, ClipboardPlus, Droplets, Eye, Leaf, Scissors, Shovel, Spline, Sprout, type LucideIcon } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';
import {
  CARE_SECTIONS,
  EVENT_KIND_LABELS,
  FERTILIZER_FORM_LABELS,
  type Bonsai,
  type CareEvent,
  type EventKind,
  type Photo,
} from '../../shared/model';
import { photoUrl } from '../lib/api';
import { formatDate } from '../lib/format';

export const EVENT_ICONS: Record<EventKind, LucideIcon> = {
  repotting: Shovel,
  pruning: Scissors,
  shootCutting: Sprout,
  wiring: Spline,
  defoliation: Leaf,
  fertilizing: Droplets,
  observation: Eye,
};

/** One line with the extra fields of an entry: "Akadama 70%, pomice 30% · Vaso Tokoname". */
export function eventSummary(event: Pick<CareEvent, 'kind' | 'details' | 'tools'>): string {
  const d = event.details;
  const linked = event.tools.map((t) => t.name);
  const parts =
    event.kind === 'repotting'
      ? [d.mix || linked.join(', '), d.pot && `Vaso: ${d.pot}`]
      : event.kind === 'fertilizing'
        ? [d.product || linked.join(', '), d.form && FERTILIZER_FORM_LABELS[d.form], d.dose]
        : [];
  return parts.filter(Boolean).join(' · ');
}

/** "ogni 21 giorni", "ogni 3 mesi", "ogni 2 anni" from an average number of days. */
export function formatDays(days: number): string {
  if (days < 60) return days === 1 ? 'ogni giorno' : `ogni ${days} giorni`;
  const months = Math.round(days / 30.44);
  if (months < 24) return `ogni ${months} mesi`;
  const years = Math.round((days / 365.25) * 2) / 2;
  return `ogni ${String(years).replace('.', ',')} anni`;
}

/** A date saved in the card by the first version ("Ultimo Rinvaso"), shown in the diary as read-only. */
interface LegacyEntry {
  kind: EventKind;
  date: string;
}

function legacyEntries(bonsai: Bonsai, events: CareEvent[]): LegacyEntry[] {
  return CARE_SECTIONS.filter((c) => c.dateLabel)
    .map((c) => ({ kind: c.key, date: bonsai.care[c.key].lastDate ?? '' }))
    .filter((l) => l.date && !events.some((e) => e.kind === l.kind && e.date === l.date));
}

export interface EntryPhoto extends Photo {
  caption: string;
}

/** Photos of all entries, newest first, each with "20 marzo 2026 · Rinvaso". */
export function entryPhotos(events: CareEvent[]): EntryPhoto[] {
  return events.flatMap((e) => e.photos.map((p) => ({ ...p, caption: `${formatDate(e.date)} · ${EVENT_KIND_LABELS[e.kind]}` })));
}

/** "Storico" of a bonsai: the latest entries (all on request), filter by task, open an entry to edit it. */
export function DiaryTimeline({
  bonsai,
  events,
  limit = 5,
  onOpenPhoto,
}: {
  bonsai: Bonsai;
  events: CareEvent[];
  limit?: number;
  onOpenPhoto: (photoId: string) => void;
}) {
  const [filter, setFilter] = useState<EventKind | 'all'>('all');
  const [showAll, setShowAll] = useState(false);
  const legacy = legacyEntries(bonsai, events);
  const kinds = (Object.keys(EVENT_KIND_LABELS) as EventKind[]).filter(
    (k) => events.some((e) => e.kind === k) || legacy.some((l) => l.kind === k),
  );
  const shown = filter === 'all' ? events : events.filter((e) => e.kind === filter);
  const shownLegacy = legacy.filter((l) => filter === 'all' || l.kind === filter);

  // Entries and read-only card dates together, newest first.
  const rows = [
    ...shown.map((event) => ({ date: event.date, event, legacy: null })),
    ...shownLegacy.map((l) => ({ date: l.date, event: null, legacy: l })),
  ].sort((a, b) => b.date.localeCompare(a.date));
  const visible = showAll ? rows : rows.slice(0, limit);

  if (!rows.length && filter === 'all') {
    return (
      <p className="card-text muted">
        Nessun intervento registrato. Registra rinvasi, concimazioni e potature: con il tempo vedrai come risponde la pianta.
      </p>
    );
  }

  return (
    <>
      {kinds.length > 1 && (
        <div className="chips" role="group" aria-label="Filtra per intervento">
          {(['all', ...kinds] as const).map((k) => (
            <button key={k} type="button" className={`chip-button${filter === k ? ' is-active' : ''}`} aria-pressed={filter === k} onClick={() => setFilter(k)}>
              {k === 'all' ? 'Tutti' : EVENT_KIND_LABELS[k]}
            </button>
          ))}
        </div>
      )}
      <ul className="list diary">
        {visible.map(({ event, legacy: l }) => {
          if (l) {
            const Icon = EVENT_ICONS[l.kind];
            return (
              <li key={`legacy-${l.kind}`} className="row">
                <div className="row-main">
                  <Icon size={20} className="row-leading-icon" aria-hidden="true" />
                  <span className="row-text">
                    <span className="row-title">{EVENT_KIND_LABELS[l.kind]}</span>
                    <span className="row-subtitle">{formatDate(l.date)} · data salvata nella scheda</span>
                  </span>
                </div>
              </li>
            );
          }
          const e = event!;
          const Icon = EVENT_ICONS[e.kind];
          const summary = eventSummary(e);
          return (
            <li key={e.id} className="row">
              <Link to={`/bonsai/${bonsai.id}/storico/${e.id}`} className="row-main diary-entry">
                <Icon size={20} className="row-leading-icon" aria-hidden="true" />
                <span className="row-text">
                  <span className="row-title">
                    {EVENT_KIND_LABELS[e.kind]}
                    {e.batchId && <span className="badge">gruppo</span>}
                  </span>
                  <span className="row-subtitle">{formatDate(e.date)}</span>
                  {summary && <span className="diary-summary">{summary}</span>}
                  {e.notes && <span className="diary-notes">{e.notes}</span>}
                </span>
                <ChevronRight size={18} className="row-chevron" aria-hidden="true" />
              </Link>
              {e.photos.length > 0 && (
                <div className="diary-photos">
                  {e.photos.map((p, i) => (
                    <button key={p.id} type="button" className="diary-photo" onClick={() => onOpenPhoto(p.id)} aria-label={`Apri foto ${i + 1} di ${EVENT_KIND_LABELS[e.kind]} del ${formatDate(e.date)}`}>
                      <img src={photoUrl(p.id)} alt="" loading="lazy" />
                    </button>
                  ))}
                </div>
              )}
            </li>
          );
        })}
        {!rows.length && <li className="card-text muted">Nessun intervento di questo tipo.</li>}
      </ul>
      {rows.length > limit && (
        <button type="button" className="row-main row-action diary-more" onClick={() => setShowAll((v) => !v)}>
          {showAll ? 'Mostra solo gli ultimi' : `Mostra tutti (${rows.length})`}
        </button>
      )}
    </>
  );
}

export function RecordLink({ to, label = 'Registra intervento' }: { to: string; label?: string }) {
  return (
    <Link to={to} className="section-action">
      <ClipboardPlus size={16} aria-hidden="true" /> {label}
    </Link>
  );
}

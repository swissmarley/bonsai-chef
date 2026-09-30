import { Bell, BellPlus, ClipboardPlus, Repeat, SquarePen, TreeDeciduous, X } from 'lucide-react';
import { useState } from 'react';
import { Link, useParams } from 'react-router';
import {
  BONSAI_CATEGORY_LABELS,
  CARE_SECTIONS,
  careHistory,
  formatFrequency,
  formatMonthRange,
  toIsoDate,
  type CareEvent,
  type CareFrequency,
  type CareHistory,
  type CareSection,
  type CareSectionConfig,
  type Photo,
  type Reminder,
} from '../../shared/model';
import { ConfirmDialog } from '../components/Dialog';
import { DiaryTimeline, entryPhotos, formatDays, RecordLink } from '../components/Diary';
import { InfoRow, Section } from '../components/Fields';
import { MonthBar } from '../components/Months';
import { PageHeader } from '../components/PageHeader';
import { PhotoGrid, PhotoViewer } from '../components/Photos';
import { ReminderSheet } from '../components/ReminderSheet';
import { EmptyState, ErrorState, PageSpinner, Spinner } from '../components/States';
import { photoUrl } from '../lib/api';
import { formatDate, formatDateTime } from '../lib/format';
import { lastTab } from '../lib/navigation';
import { useBonsaiList, useDeleteReminder, useEvents, useGroups, useReminders } from '../lib/queries';

function CareCard({
  bonsaiId,
  config,
  section,
  history,
  frequency,
  lastEvent,
}: {
  bonsaiId: string;
  config: CareSectionConfig;
  section: CareSection;
  history: CareHistory;
  frequency: CareFrequency | undefined;
  lastEvent: CareEvent | undefined;
}) {
  const range = formatMonthRange(section.startMonth, section.endMonth);
  const empty = !range && !section.notes && !history.last && !section.fertilizerType && !frequency;
  const late = history.nextDue != null && history.nextDue < toIsoDate(new Date());
  const canRepeat = lastEvent && (config.key === 'fertilizing' || config.key === 'repotting');
  return (
    <Section title={config.title}>
      {empty && <p className="card-text muted">Nessuna informazione.</p>}
      {config.extraLabel && section.fertilizerType && <InfoRow label={config.extraLabel} value={section.fertilizerType} />}
      {history.last && <InfoRow label={config.dateLabel ?? 'Ultima volta'} value={formatDate(history.last)} />}
      {history.dates.length > 1 && (
        <InfoRow
          label="Fatto"
          value={`${history.dates.length} volte${history.averageDays ? `, in media ${formatDays(history.averageDays)}` : ''}`}
        />
      )}
      {frequency && (
        <InfoRow label="Frequenza" value={`${formatFrequency(frequency)}${frequency.autoReminder ? ' · promemoria automatico' : ''}`} />
      )}
      {history.nextDue && (
        <InfoRow
          label="Prossimo"
          value={<span className={late ? 'is-late' : undefined}>{`${formatDate(history.nextDue)}${late ? ' · in ritardo' : ''}`}</span>}
        />
      )}
      {range && (
        <div className="card-block">
          <p className="care-period">
            Periodo Migliore: <strong>{range}</strong>
          </p>
          <MonthBar start={section.startMonth} end={section.endMonth} />
        </div>
      )}
      {section.notes && <p className="card-text prewrap">{section.notes}</p>}
      <div className="card-actions">
        <Link to={`/bonsai/${bonsaiId}/storico/nuovo?tipo=${config.key}`} className="btn btn-secondary btn-small">
          <ClipboardPlus size={16} aria-hidden="true" /> Registra
        </Link>
        {canRepeat && (
          <Link to={`/bonsai/${bonsaiId}/storico/nuovo?da=${lastEvent.id}`} className="btn btn-secondary btn-small">
            <Repeat size={16} aria-hidden="true" /> Ripeti l’ultimo
          </Link>
        )}
      </div>
    </Section>
  );
}

function RemindersCard({ reminders, onAdd }: { reminders: Reminder[]; onAdd: () => void }) {
  const remove = useDeleteReminder();
  const [toCancel, setToCancel] = useState<Reminder | null>(null);
  return (
    <Section title="Promemoria">
      <ul className="list">
        {reminders.map((r) => (
          <li key={r.id} className="row">
            <div className="row-main">
              <Bell size={18} className="row-leading-icon" aria-hidden="true" />
              <span className="row-text">
                <span className="row-title">{r.message || 'Promemoria'}</span>
                <span className="row-subtitle">
                  {formatDateTime(r.remindAt)}
                  {r.careKind && ' · automatico'}
                </span>
              </span>
              <button type="button" className="icon-button" aria-label="Annulla promemoria" onClick={() => setToCancel(r)}>
                <X size={18} aria-hidden="true" />
              </button>
            </div>
          </li>
        ))}
        <li className="row">
          <button type="button" className="row-main row-action" onClick={onAdd}>
            <BellPlus size={18} className="row-leading-icon" aria-hidden="true" /> Nuovo promemoria
          </button>
        </li>
      </ul>
      {toCancel && (
        <ConfirmDialog
          title="Annullare il promemoria?"
          message={`${toCancel.message || 'Promemoria'} — ${formatDateTime(toCancel.remindAt)}`}
          confirmLabel="Annulla promemoria"
          busy={remove.isPending}
          error={remove.error?.message}
          onConfirm={() => remove.mutate(toCancel.id, { onSuccess: () => setToCancel(null) })}
          onCancel={() => setToCancel(null)}
        />
      )}
    </Section>
  );
}

export function BonsaiDetailPage() {
  const { id } = useParams();
  const list = useBonsaiList();
  const reminders = useReminders();
  const groups = useGroups();
  const events = useEvents(id);
  const [viewer, setViewer] = useState<{ photos: (Photo & { caption?: string })[]; index: number } | null>(null);
  const [reminderSheet, setReminderSheet] = useState(false);
  const bonsai = list.data?.find((b) => b.id === id);
  const back = lastTab();

  if (!bonsai) {
    return (
      <>
        <PageHeader title="Bonsai" back={back} />
        <div className="page-content">
          {list.isPending ? (
            <PageSpinner />
          ) : list.isError ? (
            <ErrorState error={list.error} onRetry={() => void list.refetch()} />
          ) : (
            <EmptyState icon={TreeDeciduous} title="Bonsai non trovato" text="Potrebbe essere stato eliminato.">
              <Link to={back} className="btn btn-secondary">
                Torna all’elenco
              </Link>
            </EmptyState>
          )}
        </div>
      </>
    );
  }

  const pending = (reminders.data ?? []).filter((r) => r.bonsaiId === bonsai.id);
  const group = groups.data?.find((g) => g.id === bonsai.groupId);
  const diary = events.data ?? [];
  const diaryPhotos = entryPhotos(diary);

  return (
    <>
      <PageHeader
        title={bonsai.name}
        back={back}
        right={
          <>
            <button type="button" className="icon-button" onClick={() => setReminderSheet(true)} aria-label="Imposta promemoria">
              <Bell size={22} aria-hidden="true" />
            </button>
            <Link to={`/bonsai/${bonsai.id}/modifica`} className="icon-button" aria-label="Modifica bonsai">
              <SquarePen size={22} aria-hidden="true" />
            </Link>
          </>
        }
      />
      <div className="page-content">
        {bonsai.photos[0] && (
          <button type="button" className="cover" onClick={() => setViewer({ photos: bonsai.photos, index: 0 })} aria-label="Apri le foto">
            <img src={photoUrl(bonsai.photos[0].id)} alt={bonsai.name} />
          </button>
        )}
        <div className="detail-heading">
          <h2>{bonsai.name}</h2>
          <span className="chip">{BONSAI_CATEGORY_LABELS[bonsai.category]}</span>
          {group && <span className="chip chip-muted">{group.name}</span>}
        </div>

        <Section>
          <InfoRow label="Substrato" value={bonsai.substrate} />
          <InfoRow label="Vaso" value={bonsai.pot} />
        </Section>

        {pending.length > 0 && <RemindersCard reminders={pending} onAdd={() => setReminderSheet(true)} />}

        <section className="section">
          <div className="section-header">
            <h2 className="section-title">Storico</h2>
            <RecordLink to={`/bonsai/${bonsai.id}/storico/nuovo`} />
          </div>
          <div className="card">
            {events.isPending ? (
              <div className="card-text">
                <Spinner />
              </div>
            ) : events.isError && !events.data ? (
              <p className="card-text">
                {events.error.message}{' '}
                <button type="button" className="link-button" onClick={() => void events.refetch()}>
                  Riprova
                </button>
              </p>
            ) : (
              <DiaryTimeline
                bonsai={bonsai}
                events={diary}
                onOpenPhoto={(photoId) => setViewer({ photos: diaryPhotos, index: diaryPhotos.findIndex((p) => p.id === photoId) })}
              />
            )}
          </div>
        </section>

        {CARE_SECTIONS.map((config) => (
          <CareCard
            key={config.key}
            bonsaiId={bonsai.id}
            config={config}
            section={bonsai.care[config.key]}
            history={careHistory(diary, config.key, bonsai.care[config.key].lastDate, bonsai.schedule[config.key])}
            frequency={bonsai.schedule[config.key]}
            lastEvent={diary.find((e) => e.kind === config.key)}
          />
        ))}

        <Section title="Foto">
          {bonsai.photos.length ? (
            <PhotoGrid photos={bonsai.photos} onOpen={(index) => setViewer({ photos: bonsai.photos, index })} />
          ) : (
            <p className="card-text muted">
              Nessuna foto. <Link to={`/bonsai/${bonsai.id}/modifica`}>Aggiungine una</Link>.
            </p>
          )}
        </Section>

        {diaryPhotos.length > 0 && (
          <Section title="Foto degli interventi" footer="Dalla più recente: scorri per vedere come cambia la pianta nel tempo.">
            <PhotoGrid photos={diaryPhotos} onOpen={(index) => setViewer({ photos: diaryPhotos, index })} />
          </Section>
        )}
      </div>

      {viewer && <PhotoViewer photos={viewer.photos} index={viewer.index} onClose={() => setViewer(null)} />}
      {reminderSheet && <ReminderSheet bonsai={bonsai} onClose={() => setReminderSheet(false)} />}
    </>
  );
}

import { Bell, BellPlus, SquarePen, TreeDeciduous, X } from 'lucide-react';
import { useState } from 'react';
import { Link, useParams } from 'react-router';
import { BONSAI_CATEGORY_LABELS, CARE_SECTIONS, formatMonthRange, type CareSection, type CareSectionConfig } from '../../shared/model';
import { ConfirmDialog } from '../components/Dialog';
import { InfoRow, Section } from '../components/Fields';
import { MonthBar } from '../components/Months';
import { PageHeader } from '../components/PageHeader';
import { PhotoGrid, PhotoViewer } from '../components/Photos';
import { ReminderSheet } from '../components/ReminderSheet';
import { EmptyState, ErrorState, PageSpinner } from '../components/States';
import { photoUrl } from '../lib/api';
import { formatDate, formatDateTime } from '../lib/format';
import { lastTab } from '../lib/navigation';
import { useBonsaiList, useDeleteReminder, useReminders } from '../lib/queries';
import type { Reminder } from '../../shared/model';

function CareCard({ config, section }: { config: CareSectionConfig; section: CareSection }) {
  const range = formatMonthRange(section.startMonth, section.endMonth);
  const empty = !range && !section.notes && !section.lastDate && !section.fertilizerType;
  return (
    <Section title={config.title}>
      {empty ? (
        <p className="card-text muted">Nessuna informazione.</p>
      ) : (
        <>
          {config.extraLabel && section.fertilizerType && <InfoRow label={config.extraLabel} value={section.fertilizerType} />}
          {config.dateLabel && section.lastDate && <InfoRow label={config.dateLabel} value={formatDate(section.lastDate)} />}
          {range && (
            <div className="card-block">
              <p className="care-period">
                Periodo Migliore: <strong>{range}</strong>
              </p>
              <MonthBar start={section.startMonth} end={section.endMonth} />
            </div>
          )}
          {section.notes && <p className="card-text prewrap">{section.notes}</p>}
        </>
      )}
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
                <span className="row-subtitle">{formatDateTime(r.remindAt)}</span>
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
  const [viewer, setViewer] = useState<number | null>(null);
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
          <button type="button" className="cover" onClick={() => setViewer(0)} aria-label="Apri le foto">
            <img src={photoUrl(bonsai.photos[0].id)} alt={bonsai.name} />
          </button>
        )}
        <div className="detail-heading">
          <h2>{bonsai.name}</h2>
          <span className="chip">{BONSAI_CATEGORY_LABELS[bonsai.category]}</span>
        </div>

        <Section>
          <InfoRow label="Substrato" value={bonsai.substrate} />
          <InfoRow label="Vaso" value={bonsai.pot} />
        </Section>

        {pending.length > 0 && <RemindersCard reminders={pending} onAdd={() => setReminderSheet(true)} />}

        {CARE_SECTIONS.map((config) => (
          <CareCard key={config.key} config={config} section={bonsai.care[config.key]} />
        ))}

        <Section title="Foto">
          {bonsai.photos.length ? (
            <PhotoGrid photos={bonsai.photos} onOpen={setViewer} />
          ) : (
            <p className="card-text muted">
              Nessuna foto. <Link to={`/bonsai/${bonsai.id}/modifica`}>Aggiungine una</Link>.
            </p>
          )}
        </Section>
      </div>

      {viewer !== null && <PhotoViewer photos={bonsai.photos} index={viewer} onClose={() => setViewer(null)} />}
      {reminderSheet && <ReminderSheet bonsai={bonsai} onClose={() => setReminderSheet(false)} />}
    </>
  );
}

import { Trash2, TreeDeciduous } from 'lucide-react';
import { useMemo, useRef, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router';
import {
  BONSAI_CATEGORIES,
  BONSAI_CATEGORY_LABELS,
  CARE_SECTIONS,
  emptyCare,
  type Bonsai,
  type BonsaiCare,
  type BonsaiCategory,
  type BonsaiSchedule,
  type CareFrequency,
  type CareKey,
  type CareSection,
} from '../../shared/model';
import { ConfirmDialog } from '../components/Dialog';
import { Section, Segmented, TextArea, TextField } from '../components/Fields';
import { FrequencyInput } from '../components/Frequency';
import { GroupSelect } from '../components/Groups';
import { MonthRangeInput } from '../components/Months';
import { PageHeader } from '../components/PageHeader';
import { PhotoEditor, toPhotoItems, type PhotoItem } from '../components/Photos';
import { EmptyState, PageSpinner, Spinner } from '../components/States';
import { useToast } from '../components/Toast';
import { lastTab, useGoBack } from '../lib/navigation';
import { useBonsaiList, useDeleteBonsai, useSaveBonsai } from '../lib/queries';
import { useUnsavedGuard } from '../lib/useUnsavedGuard';

interface FormState {
  name: string;
  category: BonsaiCategory;
  substrate: string;
  pot: string;
  care: BonsaiCare;
  groupId: string | null;
  schedule: BonsaiSchedule;
}

const CATEGORY_OPTIONS = BONSAI_CATEGORIES.map((value) => ({ value, label: BONSAI_CATEGORY_LABELS[value] }));

export function BonsaiFormPage() {
  const { id } = useParams();
  const list = useBonsaiList();
  if (!id) return <BonsaiForm />;
  const existing = list.data?.find((b) => b.id === id);
  if (existing) return <BonsaiForm key={existing.id} existing={existing} />;
  return (
    <>
      <PageHeader title="Modifica Bonsai" back={lastTab()} />
      <div className="page-content">
        {list.isPending ? (
          <PageSpinner />
        ) : (
          <EmptyState icon={TreeDeciduous} title="Bonsai non trovato">
            <Link to={lastTab()} className="btn btn-secondary">
              Torna all’elenco
            </Link>
          </EmptyState>
        )}
      </div>
    </>
  );
}

/** "Aggiungi Bonsai" / "Modifica Bonsai": the same fields and sections as the iOS form. */
function BonsaiForm({ existing }: { existing?: Bonsai }) {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const goBack = useGoBack();
  const toast = useToast();
  const save = useSaveBonsai();
  const remove = useDeleteBonsai();
  const nameInput = useRef<HTMLInputElement>(null);

  // Snapshot taken once, when the form opens, to detect unsaved changes.
  const [initial] = useState<FormState>(() => ({
    name: existing?.name ?? '',
    category: existing?.category ?? (params.get('categoria') === 'interno' ? 'interno' : 'esterno'),
    substrate: existing?.substrate ?? '',
    pot: existing?.pot ?? '',
    care: existing?.care ?? emptyCare(),
    groupId: existing?.groupId ?? params.get('gruppo') ?? null,
    schedule: existing?.schedule ?? {},
  }));
  const initialPhotos = useMemo(() => (existing?.photos ?? []).map((p) => p.id).join(), [existing]);
  const [form, setForm] = useState<FormState>(initial);
  const [photos, setPhotos] = useState<PhotoItem[]>(() => toPhotoItems(existing?.photos ?? []));
  const [error, setError] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);

  const dirty = JSON.stringify(form) !== JSON.stringify(initial) || photos.map((p) => p.id ?? p.key).join() !== initialPhotos;
  const guard = useUnsavedGuard(dirty);
  const uploading = photos.some((p) => p.status === 'uploading');
  const cancelTo = existing ? `/bonsai/${existing.id}` : lastTab();

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((f) => ({ ...f, [key]: value }));
  const setCare = (key: CareKey, patch: Partial<CareSection>) =>
    setForm((f) => ({ ...f, care: { ...f.care, [key]: { ...f.care[key], ...patch } } }));
  const setFrequency = (key: CareKey, value: CareFrequency | undefined) =>
    setForm((f) => {
      const schedule = { ...f.schedule };
      if (value) schedule[key] = value;
      else delete schedule[key];
      return { ...f, schedule };
    });

  async function submit(e?: FormEvent) {
    e?.preventDefault();
    setError('');
    if (!form.name.trim()) {
      setError('Il nome è obbligatorio.');
      nameInput.current?.focus();
      return;
    }
    if (uploading) return setError('Attendi la fine del caricamento delle foto.');
    try {
      const saved = await save.mutateAsync({
        id: existing?.id,
        input: {
          ...form,
          name: form.name.trim(),
          photoIds: photos.filter((p) => p.status === 'ready' && p.id).map((p) => p.id!),
        },
      });
      guard.release();
      toast(existing ? 'Modifiche salvate.' : `«${saved.name}» aggiunto.`, 'success');
      if (existing) goBack(`/bonsai/${saved.id}`);
      else navigate(`/bonsai/${saved.id}`, { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Salvataggio non riuscito.');
    }
  }

  async function deleteBonsai() {
    if (!existing) return;
    try {
      await remove.mutateAsync(existing.id);
      guard.release();
      toast(`«${existing.name}» eliminato.`, 'success');
      navigate(lastTab(), { replace: true });
    } catch {
      // error shown in the dialog
    }
  }

  const saveLabel = save.isPending ? <Spinner label="Salvataggio…" /> : 'Salva';

  return (
    <>
      <PageHeader
        title={existing ? 'Modifica Bonsai' : 'Aggiungi Bonsai'}
        left={
          <button type="button" className="nav-button" onClick={() => goBack(cancelTo)}>
            Annulla
          </button>
        }
        right={
          <button type="submit" form="bonsai-form" className="nav-button is-strong" disabled={save.isPending || uploading}>
            {saveLabel}
          </button>
        }
      />
      <form id="bonsai-form" className="page-content" onSubmit={submit} noValidate>
        <Section>
          <TextField
            ref={nameInput}
            label="Nome"
            value={form.name}
            onChange={(e) => set('name', e.target.value)}
            placeholder="Es. Ginepro Itoigawa"
            maxLength={120}
            required
            autoFocus={!existing}
          />
          <Segmented label="Categoria" value={form.category} options={CATEGORY_OPTIONS} onChange={(v) => set('category', v)} />
          <GroupSelect value={form.groupId} onChange={(v) => set('groupId', v)} />
          <TextField label="Substrato" value={form.substrate} onChange={(e) => set('substrate', e.target.value)} maxLength={300} />
          <TextField label="Vaso" value={form.pot} onChange={(e) => set('pot', e.target.value)} maxLength={300} />
        </Section>

        {CARE_SECTIONS.map((config) => {
          const section = form.care[config.key];
          return (
            <Section
              key={config.key}
              title={config.title}
              footer={config.dateLabel && existing ? 'Ogni intervento fatto si può registrare nello Storico della scheda del bonsai.' : undefined}
            >
              {config.dateLabel && (
                <TextField
                  label={config.dateLabel}
                  type="date"
                  value={section.lastDate ?? ''}
                  onChange={(e) => setCare(config.key, { lastDate: e.target.value || null })}
                />
              )}
              {config.extraLabel && (
                <TextField
                  label={config.extraLabel}
                  value={section.fertilizerType ?? ''}
                  onChange={(e) => setCare(config.key, { fertilizerType: e.target.value })}
                  maxLength={200}
                />
              )}
              <MonthRangeInput
                start={section.startMonth}
                end={section.endMonth}
                onChange={(startMonth, endMonth) => setCare(config.key, { startMonth, endMonth })}
              />
              <FrequencyInput careKey={config.key} value={form.schedule[config.key]} onChange={(v) => setFrequency(config.key, v)} />
              <TextArea label="Note" value={section.notes} onChange={(e) => setCare(config.key, { notes: e.target.value })} maxLength={5000} />
            </Section>
          );
        })}

        <Section title="Foto">
          <PhotoEditor items={photos} setItems={setPhotos} />
        </Section>

        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <div className="form-actions">
          <button type="submit" className="btn btn-primary btn-block" disabled={save.isPending || uploading}>
            {uploading ? 'Caricamento foto…' : existing ? 'Salva Modifiche' : saveLabel}
          </button>
          {existing && (
            <button type="button" className="btn btn-danger-outline btn-block" onClick={() => setConfirmDelete(true)}>
              <Trash2 size={18} aria-hidden="true" /> Elimina Bonsai
            </button>
          )}
        </div>
      </form>

      {guard.dialog}
      {confirmDelete && existing && (
        <ConfirmDialog
          title={`Eliminare «${existing.name}»?`}
          message="Il bonsai, le sue foto e i promemoria verranno eliminati definitivamente."
          busy={remove.isPending}
          error={remove.error?.message}
          onConfirm={() => void deleteBonsai()}
          onCancel={() => setConfirmDelete(false)}
        />
      )}
    </>
  );
}

import { Hammer, Trash2 } from 'lucide-react';
import { useMemo, useRef, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { TOOL_TYPE_LABELS, TOOL_TYPES, type Tool, type ToolType } from '../../shared/model';
import { ConfirmDialog } from '../components/Dialog';
import { Section, Segmented, TextArea, TextField } from '../components/Fields';
import { PageHeader } from '../components/PageHeader';
import { PhotoEditor, toPhotoItems, type PhotoItem } from '../components/Photos';
import { EmptyState, PageSpinner, Spinner } from '../components/States';
import { useToast } from '../components/Toast';
import { lastTab, useGoBack } from '../lib/navigation';
import { useDeleteTool, useSaveTool, useToolList } from '../lib/queries';
import { useUnsavedGuard } from '../lib/useUnsavedGuard';

interface FormState {
  name: string;
  type: ToolType;
  genre: string;
  seller: string;
  price: string;
  links: string;
  details: string;
}

const TYPE_OPTIONS = TOOL_TYPES.map((value) => ({ value, label: TOOL_TYPE_LABELS[value] }));

export function ToolFormPage() {
  const { id } = useParams();
  const list = useToolList();
  if (!id) return <ToolForm />;
  const existing = list.data?.find((t) => t.id === id);
  if (existing) return <ToolForm key={existing.id} existing={existing} />;
  return (
    <>
      <PageHeader title="Modifica Strumento" back={lastTab()} />
      <div className="page-content">
        {list.isPending ? (
          <PageSpinner />
        ) : (
          <EmptyState icon={Hammer} title="Strumento non trovato">
            <Link to={lastTab()} className="btn btn-secondary">
              Torna all’elenco
            </Link>
          </EmptyState>
        )}
      </div>
    </>
  );
}

/** "Aggiungi Strumento" / "Modifica Strumento" from the iOS app. */
function ToolForm({ existing }: { existing?: Tool }) {
  const navigate = useNavigate();
  const goBack = useGoBack();
  const toast = useToast();
  const save = useSaveTool();
  const remove = useDeleteTool();
  const nameInput = useRef<HTMLInputElement>(null);

  // Snapshot taken once, when the form opens, to detect unsaved changes.
  const [initial] = useState<FormState>(() => ({
    name: existing?.name ?? '',
    type: existing?.type ?? 'attrezzo',
    genre: existing?.genre ?? '',
    seller: existing?.seller ?? '',
    price: existing?.price ?? '',
    links: existing?.links ?? '',
    details: existing?.details ?? '',
  }));
  const initialPhotos = useMemo(() => (existing?.photos ?? []).map((p) => p.id).join(), [existing]);
  const [form, setForm] = useState<FormState>(initial);
  const [photos, setPhotos] = useState<PhotoItem[]>(() => toPhotoItems(existing?.photos ?? []));
  const [error, setError] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);

  const dirty = JSON.stringify(form) !== JSON.stringify(initial) || photos.map((p) => p.id ?? p.key).join() !== initialPhotos;
  const guard = useUnsavedGuard(dirty);
  const uploading = photos.some((p) => p.status === 'uploading');
  const cancelTo = existing ? `/strumenti/${existing.id}` : lastTab();

  const field = (key: keyof FormState) => ({
    value: form[key],
    onChange: (e: { target: { value: string } }) => setForm((f) => ({ ...f, [key]: e.target.value })),
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
      if (existing) goBack(`/strumenti/${saved.id}`);
      else navigate(`/strumenti/${saved.id}`, { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Salvataggio non riuscito.');
    }
  }

  async function deleteTool() {
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
        title={existing ? 'Modifica Strumento' : 'Aggiungi Strumento'}
        left={
          <button type="button" className="nav-button" onClick={() => goBack(cancelTo)}>
            Annulla
          </button>
        }
        right={
          <button type="submit" form="tool-form" className="nav-button is-strong" disabled={save.isPending || uploading}>
            {saveLabel}
          </button>
        }
      />
      <form id="tool-form" className="page-content" onSubmit={submit} noValidate>
        <Section>
          <TextField ref={nameInput} label="Nome" {...field('name')} placeholder="Es. Forbici concave" maxLength={120} required autoFocus={!existing} />
          <Segmented label="Tipologia" value={form.type} options={TYPE_OPTIONS} onChange={(type) => setForm((f) => ({ ...f, type }))} />
        </Section>
        <Section>
          <TextField label="Genere" {...field('genre')} maxLength={300} />
          <TextField label="Venditore" {...field('seller')} maxLength={300} />
          <TextField label="Prezzo" {...field('price')} inputMode="decimal" placeholder="Es. 35 €" maxLength={100} />
        </Section>
        <Section title="Link" footer="Un indirizzo per riga: diventeranno link cliccabili.">
          <TextArea label="Link" hideLabel {...field('links')} placeholder="https://…" maxLength={5000} />
        </Section>
        <Section title="Dettagli">
          <TextArea label="Dettagli" hideLabel {...field('details')} rows={4} maxLength={5000} />
        </Section>
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
              <Trash2 size={18} aria-hidden="true" /> Elimina Strumento
            </button>
          )}
        </div>
      </form>

      {guard.dialog}
      {confirmDelete && existing && (
        <ConfirmDialog
          title={`Eliminare «${existing.name}»?`}
          message="Lo strumento e le sue foto verranno eliminati definitivamente."
          busy={remove.isPending}
          error={remove.error?.message}
          onConfirm={() => void deleteTool()}
          onCancel={() => setConfirmDelete(false)}
        />
      )}
    </>
  );
}

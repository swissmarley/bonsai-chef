import { ClipboardList, Trash2 } from 'lucide-react';
import { useEffect, useId, useMemo, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router';
import {
  addFrequency,
  CARE_KEYS,
  EVENT_KIND_LABELS,
  EVENT_KINDS,
  FERTILIZER_FORM_LABELS,
  formatFrequency,
  parseIsoDate,
  toIsoDate,
  type Bonsai,
  type BonsaiGroup,
  type CareEvent,
  type CareEventTool,
  type CareKey,
  type EventKind,
  type FertilizerForm,
  type NextReminder,
} from '../../shared/model';
import { ConfirmDialog } from '../components/Dialog';
import { EVENT_ICONS } from '../components/Diary';
import { Section, Segmented, TextArea } from '../components/Fields';
import { PageHeader } from '../components/PageHeader';
import { PhotoEditor, toPhotoItems, type PhotoItem } from '../components/Photos';
import { EmptyState, PageSpinner, Spinner } from '../components/States';
import { useToast } from '../components/Toast';
import { ToolPicker } from '../components/ToolPicker';
import { formatDate } from '../lib/format';
import { lastTab, useGoBack } from '../lib/navigation';
import { enablePush, getPushState } from '../lib/push';
import { useBonsaiList, useCreateEvents, useDeleteEvent, useEventSuggestions, useEvents, useGroups, useUpdateEvent } from '../lib/queries';
import { useUnsavedGuard } from '../lib/useUnsavedGuard';

const isCareKey = (kind: string): kind is CareKey => (CARE_KEYS as readonly string[]).includes(kind);

/**
 * Routes: /bonsai/:id/storico/nuovo (?tipo=…, ?da=<entry to repeat>), /bonsai/:id/storico/:eventId,
 * /gruppi/:groupId/storico/nuovo (?vista=esterno|interno).
 */
export function EventFormPage() {
  const { id, eventId, groupId } = useParams();
  const [params] = useSearchParams();
  const bonsaiList = useBonsaiList();
  const groups = useGroups();
  const events = useEvents(id);
  const back = id ? `/bonsai/${id}` : lastTab();

  const bonsai = id ? bonsaiList.data?.find((b) => b.id === id) : undefined;
  const group = groupId ? groups.data?.find((g) => g.id === groupId) : bonsai?.groupId ? groups.data?.find((g) => g.id === bonsai.groupId) : undefined;
  const loading = bonsaiList.isPending || ((!!groupId || !!bonsai?.groupId) && groups.isPending) || (!!id && events.isPending);

  const existing = eventId ? events.data?.find((e) => e.id === eventId) : undefined;
  const missing = !loading && ((id && !bonsai) || (groupId && !group) || (eventId && !existing));

  if (loading || missing) {
    return (
      <>
        <PageHeader title={eventId ? 'Modifica intervento' : 'Registra intervento'} back={back} />
        <div className="page-content">
          {loading ? (
            <PageSpinner />
          ) : (
            <EmptyState icon={ClipboardList} title={eventId ? 'Intervento non trovato' : groupId ? 'Gruppo non trovato' : 'Bonsai non trovato'}>
              <Link to={back} className="btn btn-secondary">
                Indietro
              </Link>
            </EmptyState>
          )}
        </div>
      </>
    );
  }

  // Trees that can receive the entry: the tree's group (or the group of the list), filtered by the list's tab.
  const view = params.get('vista');
  const candidates = group
    ? (bonsaiList.data ?? []).filter((b) => b.groupId === group.id && (!groupId || !view || b.category === view))
    : bonsai
      ? [bonsai]
      : [];
  if (bonsai && !candidates.some((b) => b.id === bonsai.id)) candidates.unshift(bonsai);

  const template = events.data?.find((e) => e.id === params.get('da'));
  const kindParam = params.get('tipo');
  const initialKind: EventKind = template?.kind ?? ((EVENT_KINDS as readonly string[]).includes(kindParam ?? '') ? (kindParam as EventKind) : 'fertilizing');

  return (
    <EventForm
      key={existing?.id ?? 'new'}
      existing={existing}
      bonsai={bonsai}
      group={group}
      candidates={candidates}
      initialSelected={bonsai ? [bonsai.id] : candidates.map((b) => b.id)}
      initialKind={initialKind}
      template={template}
      treeEvents={events.data ?? []}
      back={back}
    />
  );
}

interface FormState {
  kind: EventKind;
  date: string;
  notes: string;
  mix: string;
  pot: string;
  product: string;
  form: FertilizerForm | '';
  dose: string;
  tools: CareEventTool[];
  selected: string[];
  remindNext: boolean;
}

const FORM_OPTIONS = [{ value: '' as const, label: '—' }, ...(['solido', 'liquido'] as const).map((value) => ({ value, label: FERTILIZER_FORM_LABELS[value] }))];

function EventForm({
  existing,
  bonsai,
  group,
  candidates,
  initialSelected,
  initialKind,
  template,
  treeEvents,
  back,
}: {
  existing?: CareEvent;
  bonsai?: Bonsai;
  group?: BonsaiGroup;
  candidates: Bonsai[];
  initialSelected: string[];
  initialKind: EventKind;
  template?: CareEvent;
  treeEvents: CareEvent[];
  back: string;
}) {
  const navigate = useNavigate();
  const goBack = useGoBack();
  const toast = useToast();
  const create = useCreateEvents();
  const update = useUpdateEvent();
  const remove = useDeleteEvent();
  const suggestions = useEventSuggestions().data;
  const id = useId();
  const today = toIsoDate(new Date());

  const [initial] = useState<FormState>(() => {
    const source = existing ?? template;
    return {
      kind: existing?.kind ?? initialKind,
      date: existing?.date ?? today,
      notes: existing?.notes ?? '',
      mix: source?.details.mix ?? '',
      pot: source?.details.pot ?? '',
      product: source?.details.product ?? '',
      form: source?.details.form ?? '',
      dose: source?.details.dose ?? '',
      tools: source?.tools ?? [],
      selected: initialSelected,
      remindNext: false,
    };
  });
  const initialPhotos = useMemo(() => (existing?.photos ?? []).map((p) => p.id).join(), [existing]);
  const [form, setForm] = useState<FormState>(initial);
  const [photos, setPhotos] = useState<PhotoItem[]>(() => toPhotoItems(existing?.photos ?? []));
  const [error, setError] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [pushOff, setPushOff] = useState(false);

  useEffect(() => {
    getPushState().then((s) => setPushOff(s === 'off'), () => {});
  }, []);

  const dirty = JSON.stringify(form) !== JSON.stringify(initial) || photos.map((p) => p.id ?? p.key).join() !== initialPhotos;
  const guard = useUnsavedGuard(dirty);
  const uploading = photos.some((p) => p.status === 'uploading');
  const saving = create.isPending || update.isPending;
  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((f) => ({ ...f, [key]: value }));
  const oneTree = !!existing || form.selected.length === 1;

  // Next time, from the frequency of the task on each selected tree (only when this entry is the latest one).
  const reminders = useMemo(() => {
    const kind = form.kind;
    if (existing || !isCareKey(kind) || !form.date || form.date > today) return [];
    return candidates
      .filter((b) => form.selected.includes(b.id) && b.schedule[kind])
      .flatMap((b) => {
        const frequency = b.schedule[kind]!;
        const latest = [b.care[kind].lastDate ?? '', ...(b.id === bonsai?.id ? treeEvents.filter((e) => e.kind === kind).map((e) => e.date) : [])].sort().at(-1) ?? '';
        const due = addFrequency(form.date, frequency);
        return form.date >= latest && due > today ? [{ bonsai: b, frequency, due }] : [];
      });
  }, [existing, form.kind, form.date, form.selected, candidates, bonsai, treeEvents, today]);
  const automatic = reminders.filter((r) => r.frequency.autoReminder);
  const optional = reminders.filter((r) => !r.frequency.autoReminder);

  function setKind(kind: EventKind) {
    // Linked Strumenti belong to one kind of task (substrati for Rinvaso, concimi for Concimazione).
    setForm((f) => ({ ...f, kind, tools: kind === f.kind ? f.tools : [] }));
  }

  function toggleTree(treeId: string) {
    setForm((f) => ({ ...f, selected: f.selected.includes(treeId) ? f.selected.filter((x) => x !== treeId) : [...f.selected, treeId] }));
  }

  async function submit(e?: FormEvent) {
    e?.preventDefault();
    setError('');
    if (!form.date) return setError('Indica la data dell’intervento.');
    if (form.date > today) return setError('La data non può essere nel futuro.');
    if (!existing && !form.selected.length) return setError('Scegli almeno un bonsai.');
    if (uploading) return setError('Attendi la fine del caricamento delle foto.');

    const photoIds = oneTree ? photos.filter((p) => p.status === 'ready' && p.id).map((p) => p.id!) : [];
    const fields = {
      kind: form.kind,
      date: form.date,
      notes: form.notes.trim(),
      details:
        form.kind === 'repotting'
          ? { mix: form.mix.trim(), pot: form.pot.trim() }
          : form.kind === 'fertilizing'
            ? { product: form.product.trim(), form: form.form || null, dose: form.dose.trim() }
            : {},
      tools: form.kind === 'repotting' || form.kind === 'fertilizing' ? form.tools : [],
      photoIds,
    };
    try {
      if (existing) {
        await update.mutateAsync({ id: existing.id, input: fields });
        guard.release();
        toast('Intervento aggiornato.', 'success');
        goBack(back);
        return;
      }
      const label = form.kind === 'fertilizing' && fields.details.product ? `${EVENT_KIND_LABELS[form.kind]}: ${fields.details.product}` : EVENT_KIND_LABELS[form.kind];
      const planned = [...automatic, ...(form.remindNext ? optional : [])];
      const nextReminders: NextReminder[] = planned.map((r) => {
        const d = parseIsoDate(r.due);
        d.setHours(9, 0, 0, 0);
        return { bonsaiId: r.bonsai.id, remindAt: d.toISOString(), message: label };
      });
      if (nextReminders.length && pushOff) await enablePush().catch(() => {}); // otherwise it arrives by e-mail
      const result = await create.mutateAsync({ ...fields, bonsaiIds: form.selected, nextReminders });
      guard.release();
      const count = result.events.length;
      const reminderText =
        result.reminders.length === 1
          ? ` Promemoria il ${formatDate(planned[0].due)}.`
          : result.reminders.length > 1
            ? ` ${result.reminders.length} promemoria creati.`
            : '';
      toast(`${count > 1 ? `Intervento registrato per ${count} bonsai.` : 'Intervento registrato.'}${reminderText}`, 'success');
      if (bonsai) goBack(back);
      else navigate(back, { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Salvataggio non riuscito.');
    }
  }

  async function deleteEntry() {
    if (!existing) return;
    try {
      await remove.mutateAsync(existing);
      guard.release();
      toast('Intervento eliminato.', 'success');
      navigate(back, { replace: true });
    } catch {
      // shown in the dialog
    }
  }

  const saveLabel = saving ? <Spinner label="Salvataggio…" /> : 'Salva';
  const datalist = (key: 'mix' | 'pot' | 'product' | 'dose') =>
    suggestions?.[key].length ? (
      <datalist id={`${id}-${key}`}>
        {suggestions[key].map((v) => (
          <option key={v} value={v} />
        ))}
      </datalist>
    ) : null;

  const textInput = (key: 'mix' | 'pot' | 'product' | 'dose', label: string, placeholder: string, max: number) => (
    <div className="field">
      <label className="field-label" htmlFor={`${id}-${key}-input`}>
        {label}
      </label>
      <input
        id={`${id}-${key}-input`}
        list={`${id}-${key}`}
        value={form[key]}
        onChange={(e) => set(key, e.target.value)}
        placeholder={placeholder}
        maxLength={max}
        autoComplete="off"
      />
      {datalist(key)}
    </div>
  );

  const title = existing ? 'Modifica intervento' : 'Registra intervento';
  const subject = existing || bonsai ? (bonsai?.name ?? '') : `Gruppo «${group?.name ?? ''}»`;

  return (
    <>
      <PageHeader
        title={title}
        left={
          <button type="button" className="nav-button" onClick={() => goBack(back)}>
            Annulla
          </button>
        }
        right={
          <button type="submit" form="event-form" className="nav-button is-strong" disabled={saving || uploading}>
            {saveLabel}
          </button>
        }
      />
      <form id="event-form" className="page-content" onSubmit={submit} noValidate>
        {subject && <p className="form-subject">{subject}</p>}
        <Section>
          <div className="field">
            <span className="field-label">Intervento</span>
            <div className="kind-grid" role="radiogroup" aria-label="Intervento">
              {EVENT_KINDS.map((kind) => {
                const Icon = EVENT_ICONS[kind];
                return (
                  <button
                    key={kind}
                    type="button"
                    role="radio"
                    aria-checked={form.kind === kind}
                    className={`kind-option${form.kind === kind ? ' is-active' : ''}`}
                    onClick={() => setKind(kind)}
                  >
                    <Icon size={18} aria-hidden="true" />
                    {EVENT_KIND_LABELS[kind]}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="field">
            <label className="field-label" htmlFor={`${id}-date`}>
              Data
            </label>
            <input id={`${id}-date`} type="date" value={form.date} max={today} onChange={(e) => set('date', e.target.value)} required />
          </div>
        </Section>

        {!existing && candidates.length > 1 && (
          <Section
            title={bonsai ? `Anche per altri bonsai di «${group?.name}»` : 'Bonsai'}
            footer={form.selected.length > 1 ? 'Verrà registrato un intervento per ogni bonsai scelto.' : undefined}
          >
            <ul className="list check-list">
              {candidates.map((b) => (
                <li key={b.id}>
                  <label className="check-row">
                    <input type="checkbox" checked={form.selected.includes(b.id)} onChange={() => toggleTree(b.id)} />
                    <span>{b.name}</span>
                  </label>
                </li>
              ))}
            </ul>
            <div className="card-actions">
              <button type="button" className="btn btn-secondary btn-small" onClick={() => set('selected', candidates.map((b) => b.id))}>
                Tutti
              </button>
              {bonsai ? (
                <button type="button" className="btn btn-secondary btn-small" onClick={() => set('selected', [bonsai.id])}>
                  Solo {bonsai.name}
                </button>
              ) : (
                <button type="button" className="btn btn-secondary btn-small" onClick={() => set('selected', [])}>
                  Nessuno
                </button>
              )}
            </div>
          </Section>
        )}

        {form.kind === 'repotting' && (
          <Section title="Rinvaso">
            {textInput('mix', 'Miscela / terriccio', 'Es. Akadama 70%, pomice 30%', 500)}
            <ToolPicker type="substrato" label="Substrati usati" value={form.tools} onChange={(tools) => set('tools', tools)} />
            {textInput('pot', 'Vaso', 'Es. Tokoname ovale 30 cm', 300)}
          </Section>
        )}
        {form.kind === 'fertilizing' && (
          <Section title="Concimazione">
            {textInput('product', 'Prodotto', 'Es. Hanagokoro', 200)}
            <ToolPicker type="concime" label="Concimi usati" value={form.tools} onChange={(tools) => set('tools', tools)} />
            <Segmented label="Tipo" value={form.form} options={FORM_OPTIONS} onChange={(v) => set('form', v)} />
            {textInput('dose', 'Dose', 'Es. 5 ml per litro', 100)}
          </Section>
        )}

        <Section title="Note">
          <TextArea
            label="Note"
            hideLabel
            value={form.notes}
            onChange={(e) => set('notes', e.target.value)}
            placeholder="Come sta la pianta, cosa hai notato…"
            rows={4}
            maxLength={5000}
          />
        </Section>

        <Section title="Foto">
          {oneTree ? (
            <PhotoEditor items={photos} setItems={setPhotos} />
          ) : (
            <p className="card-text muted">Le foto si aggiungono a un bonsai alla volta: potrai aggiungerle dopo, dallo storico di ogni bonsai.</p>
          )}
        </Section>

        {(automatic.length > 0 || optional.length > 0) && (
          <Section title="Prossima volta">
            {automatic.length > 0 && (
              <p className="card-text">
                🔔 Promemoria automatico{' '}
                {automatic.length === 1
                  ? `il ${formatDate(automatic[0].due)} alle 9:00 (${formatFrequency(automatic[0].frequency)})`
                  : `per ${automatic.length} bonsai, secondo la frequenza di ognuno`}
                .
              </p>
            )}
            {optional.length > 0 && (
              <label className="check-row">
                <input type="checkbox" checked={form.remindNext} onChange={(e) => set('remindNext', e.target.checked)} />
                <span>
                  {optional.length === 1
                    ? `Ricordamelo il ${formatDate(optional[0].due)} alle 9:00 (${formatFrequency(optional[0].frequency)})`
                    : `Crea un promemoria per ${optional.length} bonsai, secondo la frequenza di ognuno`}
                </span>
              </label>
            )}
          </Section>
        )}

        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <div className="form-actions">
          <button type="submit" className="btn btn-primary btn-block" disabled={saving || uploading}>
            {uploading ? 'Caricamento foto…' : existing ? 'Salva Modifiche' : saveLabel}
          </button>
          {existing && (
            <button type="button" className="btn btn-danger-outline btn-block" onClick={() => setConfirmDelete(true)}>
              <Trash2 size={18} aria-hidden="true" /> Elimina Intervento
            </button>
          )}
        </div>
      </form>

      {guard.dialog}
      {confirmDelete && existing && (
        <ConfirmDialog
          title="Eliminare l’intervento?"
          message={
            existing.photos.length
              ? `${EVENT_KIND_LABELS[existing.kind]} del ${formatDate(existing.date)}. Le sue foto resteranno tra le foto del bonsai.`
              : `${EVENT_KIND_LABELS[existing.kind]} del ${formatDate(existing.date)}.`
          }
          busy={remove.isPending}
          error={remove.error?.message}
          onConfirm={() => void deleteEntry()}
          onCancel={() => setConfirmDelete(false)}
        />
      )}
    </>
  );
}

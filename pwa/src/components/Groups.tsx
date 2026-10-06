import { ArrowDown, ArrowUp, Check, FolderPlus, Pencil, Trash2, X } from 'lucide-react';
import { useId, useState, type FormEvent } from 'react';
import type { BonsaiGroup } from '../../shared/model';
import { useBonsaiList, useCreateGroup, useDeleteGroup, useGroups, useRenameGroup, useReorderGroups } from '../lib/queries';
import { ConfirmDialog, Dialog } from './Dialog';
import { Spinner } from './States';
import { useToast } from './Toast';

const errorText = (err: unknown) => (err instanceof Error ? err.message : 'Operazione non riuscita.');

/** "Gruppi": create, rename, reorder and delete the user's groups (deleting keeps the trees). */
export function GroupsSheet({ onClose }: { onClose: () => void }) {
  const groups = useGroups();
  const bonsai = useBonsaiList();
  const create = useCreateGroup();
  const rename = useRenameGroup();
  const reorder = useReorderGroups();
  const remove = useDeleteGroup();
  const toast = useToast();
  const id = useId();
  const [newName, setNewName] = useState('');
  const [editing, setEditing] = useState<{ id: string; name: string } | null>(null);
  const [toDelete, setToDelete] = useState<BonsaiGroup | null>(null);
  const [error, setError] = useState('');

  const list = groups.data ?? [];
  const count = (groupId: string) => (bonsai.data ?? []).filter((b) => b.groupId === groupId).length;

  async function add(e: FormEvent) {
    e.preventDefault();
    const name = newName.trim();
    if (!name) return;
    setError('');
    try {
      await create.mutateAsync(name);
      setNewName('');
    } catch (err) {
      setError(errorText(err));
    }
  }

  async function saveName(e: FormEvent) {
    e.preventDefault();
    if (!editing) return;
    setError('');
    try {
      await rename.mutateAsync({ id: editing.id, name: editing.name.trim() });
      setEditing(null);
    } catch (err) {
      setError(errorText(err));
    }
  }

  function move(index: number, delta: number) {
    const ids = list.map((g) => g.id);
    const [moved] = ids.splice(index, 1);
    ids.splice(index + delta, 0, moved);
    setError('');
    reorder.mutate(ids, { onError: (err) => setError(errorText(err)) });
  }

  async function confirmDelete() {
    if (!toDelete) return;
    try {
      await remove.mutateAsync(toDelete.id);
      toast(`Gruppo «${toDelete.name}» eliminato.`, 'success');
      setToDelete(null);
    } catch {
      // shown in the dialog
    }
  }

  return (
    <Dialog title="Gruppi" onClose={onClose}>
      <p className="sheet-text sheet-intro">
        Raccogli i bonsai in gruppi, per esempio «Pini» o «Aceri». Ogni bonsai può stare in un gruppo: lo scegli nella sua scheda.
      </p>

      {groups.isPending ? (
        <Spinner />
      ) : list.length > 0 ? (
        <ul className="group-list">
          {list.map((g, i) =>
            editing?.id === g.id ? (
              <li key={g.id} className="group-row">
                <form className="group-edit" onSubmit={saveName}>
                  <input
                    aria-label={`Nuovo nome per «${g.name}»`}
                    value={editing.name}
                    onChange={(e) => setEditing({ id: g.id, name: e.target.value })}
                    maxLength={60}
                    autoFocus
                  />
                  <button type="submit" className="icon-button" aria-label="Salva nome" disabled={!editing.name.trim() || rename.isPending}>
                    <Check size={20} aria-hidden="true" />
                  </button>
                  <button type="button" className="icon-button" aria-label="Annulla" onClick={() => setEditing(null)}>
                    <X size={20} aria-hidden="true" />
                  </button>
                </form>
              </li>
            ) : (
              <li key={g.id} className="group-row">
                <span className="group-name">
                  <strong>{g.name}</strong>
                  <span className="muted">{count(g.id) === 1 ? '1 bonsai' : `${count(g.id)} bonsai`}</span>
                </span>
                <span className="group-actions">
                  <button type="button" className="icon-button" aria-label={`Sposta «${g.name}» in su`} disabled={i === 0} onClick={() => move(i, -1)}>
                    <ArrowUp size={18} aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    className="icon-button"
                    aria-label={`Sposta «${g.name}» in giù`}
                    disabled={i === list.length - 1}
                    onClick={() => move(i, 1)}
                  >
                    <ArrowDown size={18} aria-hidden="true" />
                  </button>
                  <button type="button" className="icon-button" aria-label={`Rinomina «${g.name}»`} onClick={() => setEditing({ id: g.id, name: g.name })}>
                    <Pencil size={18} aria-hidden="true" />
                  </button>
                  <button type="button" className="icon-button is-danger" aria-label={`Elimina «${g.name}»`} onClick={() => setToDelete(g)}>
                    <Trash2 size={18} aria-hidden="true" />
                  </button>
                </span>
              </li>
            ),
          )}
        </ul>
      ) : (
        <p className="sheet-hint">Non hai ancora nessun gruppo.</p>
      )}

      <form className="group-add" onSubmit={add}>
        <label className="visually-hidden" htmlFor={`${id}-new`}>
          Nome del nuovo gruppo
        </label>
        <input id={`${id}-new`} value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Nuovo gruppo, es. Pini" maxLength={60} />
        <button type="submit" className="btn btn-secondary" disabled={!newName.trim() || create.isPending}>
          {create.isPending ? <Spinner /> : <FolderPlus size={18} aria-hidden="true" />} Aggiungi
        </button>
      </form>

      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <button type="button" className="btn btn-plain btn-block" onClick={onClose}>
        Fine
      </button>

      {toDelete && (
        <ConfirmDialog
          title={`Eliminare il gruppo «${toDelete.name}»?`}
          message="I bonsai del gruppo non verranno eliminati: resteranno senza gruppo."
          busy={remove.isPending}
          error={remove.error?.message}
          onConfirm={() => void confirmDelete()}
          onCancel={() => setToDelete(null)}
        />
      )}
    </Dialog>
  );
}

/** Asks for the name of a new group and returns it once created. */
export function NewGroupDialog({ onCreated, onClose }: { onCreated: (group: BonsaiGroup) => void; onClose: () => void }) {
  const create = useCreateGroup();
  const id = useId();
  const [name, setName] = useState('');
  const [error, setError] = useState('');

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError('');
    try {
      onCreated(await create.mutateAsync(name.trim()));
    } catch (err) {
      setError(errorText(err));
    }
  }

  return (
    <Dialog title="Nuovo gruppo" onClose={onClose} variant="alert">
      <form onSubmit={submit} className="stack">
        <div className="field">
          <label className="visually-hidden" htmlFor={id}>
            Nome del gruppo
          </label>
          <input id={id} value={name} onChange={(e) => setName(e.target.value)} placeholder="Es. Pini" maxLength={60} autoFocus />
        </div>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <div className="alert-actions">
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Annulla
          </button>
          <button type="submit" className="btn btn-primary" disabled={!name.trim() || create.isPending}>
            {create.isPending ? <Spinner label="Salvataggio…" /> : 'Crea'}
          </button>
        </div>
      </form>
    </Dialog>
  );
}

const NEW_GROUP = '__new__';

/** Group field of the bonsai form: none, one of the groups, or a new one. */
export function GroupSelect({ value, onChange }: { value: string | null; onChange: (groupId: string | null) => void }) {
  const groups = useGroups();
  const id = useId();
  const [creating, setCreating] = useState(false);
  return (
    <div className="field">
      <label className="field-label" htmlFor={id}>
        Gruppo
      </label>
      <select
        id={id}
        value={value ?? ''}
        onChange={(e) => {
          if (e.target.value === NEW_GROUP) setCreating(true);
          else onChange(e.target.value || null);
        }}
      >
        <option value="">Nessun gruppo</option>
        {(groups.data ?? []).map((g) => (
          <option key={g.id} value={g.id}>
            {g.name}
          </option>
        ))}
        <option value={NEW_GROUP}>＋ Nuovo gruppo…</option>
      </select>
      {creating && (
        <NewGroupDialog
          onCreated={(group) => {
            onChange(group.id);
            setCreating(false);
          }}
          onClose={() => setCreating(false)}
        />
      )}
    </div>
  );
}

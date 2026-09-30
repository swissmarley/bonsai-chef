import {
  Box,
  ChevronRight,
  CircleMinus,
  CircleUserRound,
  ClipboardPlus,
  FlaskConical,
  Folders,
  Hammer,
  Plus,
  Sprout,
  TreeDeciduous,
  type LucideIcon,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import {
  BONSAI_CATEGORY_LABELS,
  CARE_SECTIONS,
  TOOL_TYPE_LABELS,
  TOOL_TYPES,
  monthsInRange,
  type Bonsai,
  type BonsaiGroup,
  type Photo,
  type Tool,
  type ToolType,
} from '../../shared/model';
import { AccountSheet } from '../components/AccountSheet';
import { ConfirmDialog, Dialog } from '../components/Dialog';
import { GroupsSheet } from '../components/Groups';
import { PageHeader } from '../components/PageHeader';
import { EmptyState, ErrorState, PageSpinner } from '../components/States';
import { useToast } from '../components/Toast';
import { photoUrl } from '../lib/api';
import { rememberTab, TABS, type TabView } from '../lib/navigation';
import { useBonsaiList, useDeleteBonsai, useDeleteTool, useGroups, useToolList } from '../lib/queries';

export const TOOL_ICONS: Record<ToolType, LucideIcon> = { substrato: Sprout, concime: FlaskConical, attrezzo: Hammer, accessorio: Box };

/** Care tasks whose best period includes the current month, e.g. "Questo mese: Potatura · Concimazione". */
function careThisMonth(bonsai: Bonsai): string {
  const month = new Date().getMonth();
  const tasks = CARE_SECTIONS.filter((s) => monthsInRange(bonsai.care[s.key].startMonth, bonsai.care[s.key].endMonth).includes(month));
  return tasks.length ? `Questo mese: ${tasks.map((t) => t.title).join(' · ')}` : '';
}

function Thumb({ photos, icon: Icon }: { photos: Photo[]; icon: LucideIcon }) {
  return (
    <span className="thumb" aria-hidden="true">
      {photos[0] ? <img src={photoUrl(photos[0].id)} alt="" loading="lazy" /> : <Icon size={22} />}
    </span>
  );
}

interface RowItem {
  kind: 'bonsai' | 'tool';
  id: string;
  name: string;
  subtitle: string;
  photos: Photo[];
  icon: LucideIcon;
}

const bonsaiRow = (b: Bonsai, showCategory: boolean): RowItem => ({
  kind: 'bonsai',
  id: b.id,
  name: b.name,
  subtitle: careThisMonth(b) || (showCategory ? BONSAI_CATEGORY_LABELS[b.category] : b.substrate && `Substrato: ${b.substrate}`),
  photos: b.photos,
  icon: TreeDeciduous,
});

const toolRow = (t: Tool, showType: boolean): RowItem => ({
  kind: 'tool',
  id: t.id,
  name: t.name,
  subtitle: showType ? TOOL_TYPE_LABELS[t.type] : [t.genre, t.price].filter(Boolean).join(' · '),
  photos: t.photos,
  icon: TOOL_ICONS[t.type],
});

function RowList({ items, editing, onDelete }: { items: RowItem[]; editing: boolean; onDelete: (item: RowItem) => void }) {
  return (
    <ul className="card list">
      {items.map((item) => {
        const content = (
          <>
            <Thumb photos={item.photos} icon={item.icon} />
            <span className="row-text">
              <span className="row-title">{item.name}</span>
              {item.subtitle && <span className="row-subtitle">{item.subtitle}</span>}
            </span>
          </>
        );
        return (
          <li key={`${item.kind}-${item.id}`} className="row">
            {editing ? (
              <div className="row-main">
                <button type="button" className="row-delete" aria-label={`Elimina ${item.name}`} onClick={() => onDelete(item)}>
                  <CircleMinus size={22} aria-hidden="true" />
                </button>
                {content}
              </div>
            ) : (
              <Link to={item.kind === 'bonsai' ? `/bonsai/${item.id}` : `/strumenti/${item.id}`} className="row-main">
                {content}
                <ChevronRight size={18} className="row-chevron" aria-hidden="true" />
              </Link>
            )}
          </li>
        );
      })}
    </ul>
  );
}

interface ListSection {
  title?: string;
  /** Sections of a group can record an intervention on all their trees at once. */
  group?: BonsaiGroup;
  items: RowItem[];
}

/** Bonsai in one section per group (in the chosen order), then the ones without a group. */
function bonsaiSections(bonsai: Bonsai[], groups: BonsaiGroup[], showCategory: boolean, ungroupedTitle?: string): ListSection[] {
  const known = new Set(groups.map((g) => g.id));
  const sections: ListSection[] = groups.map((group) => ({
    title: group.name,
    group,
    items: bonsai.filter((b) => b.groupId === group.id).map((b) => bonsaiRow(b, showCategory)),
  }));
  const ungrouped = bonsai.filter((b) => !b.groupId || !known.has(b.groupId)).map((b) => bonsaiRow(b, showCategory));
  const anyGroup = sections.some((s) => s.items.length);
  sections.push({ title: anyGroup ? 'Senza gruppo' : ungroupedTitle, items: ungrouped });
  return sections;
}

export function ListPage({ view }: { view: TabView }) {
  const tab = TABS.find((t) => t.view === view)!;
  const bonsaiQuery = useBonsaiList();
  const toolQuery = useToolList();
  const groupQuery = useGroups();
  const deleteBonsai = useDeleteBonsai();
  const deleteTool = useDeleteTool();
  const navigate = useNavigate();
  const toast = useToast();
  const [editing, setEditing] = useState(false);
  const [account, setAccount] = useState(false);
  const [addMenu, setAddMenu] = useState(false);
  const [groupsSheet, setGroupsSheet] = useState(false);
  const [toDelete, setToDelete] = useState<RowItem | null>(null);
  const [deleteError, setDeleteError] = useState('');

  useEffect(() => {
    rememberTab(tab.path);
    setEditing(false);
  }, [tab.path]);

  const needsBonsai = view !== 'strumenti';
  const needsTools = view === 'tutti' || view === 'strumenti';
  const queries = [needsBonsai && bonsaiQuery, needsTools && toolQuery].filter((q) => q !== false);
  const failed = queries.find((q) => q.isError && !q.data);
  // Groups only arrange the list: without them (e.g. offline, never loaded) it still shows every tree.
  const groupsPending = needsBonsai && groupQuery.isPending && !groupQuery.isError;

  const bonsai = (bonsaiQuery.data ?? []).filter((b) => view === 'tutti' || b.category === view);
  const tools = toolQuery.data ?? [];
  const groups = groupQuery.data ?? [];

  const sections: ListSection[] =
    view === 'tutti'
      ? [...bonsaiSections(bonsai, groups, true, 'Bonsai'), { title: 'Strumenti & Altro', items: tools.map((t) => toolRow(t, true)) }]
      : view === 'strumenti'
        ? TOOL_TYPES.map((type) => ({
            title: TOOL_TYPE_LABELS[type],
            items: tools.filter((t) => t.type === type).map((t) => toolRow(t, false)),
          }))
        : bonsaiSections(bonsai, groups, false);
  const visible = sections.filter((s) => s.items.length);
  const isEmpty = visible.length === 0;

  function add() {
    if (view === 'tutti') setAddMenu(true);
    else if (view === 'strumenti') navigate('/strumenti/nuovo');
    else navigate(`/bonsai/nuovo?categoria=${view}`);
  }

  async function confirmDelete() {
    if (!toDelete) return;
    setDeleteError('');
    try {
      if (toDelete.kind === 'bonsai') await deleteBonsai.mutateAsync(toDelete.id);
      else await deleteTool.mutateAsync(toDelete.id);
      toast(`«${toDelete.name}» eliminato.`, 'success');
      setToDelete(null);
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'Eliminazione non riuscita.');
    }
  }

  return (
    <>
      <PageHeader
        title={tab.title}
        large
        left={
          <button type="button" className="icon-button" onClick={() => setAccount(true)} aria-label="Account e impostazioni">
            <CircleUserRound size={26} aria-hidden="true" />
          </button>
        }
        right={
          <>
            {!isEmpty && (
              <button type="button" className="nav-button" onClick={() => setEditing((e) => !e)}>
                {editing ? 'Fine' : 'Modifica'}
              </button>
            )}
            <button
              type="button"
              className="icon-button"
              onClick={add}
              aria-label={view === 'strumenti' ? 'Aggiungi Strumento' : view === 'tutti' ? 'Aggiungi' : 'Aggiungi Bonsai'}
            >
              <Plus size={28} aria-hidden="true" />
            </button>
          </>
        }
      />

      <div className="page-content">
        {failed ? (
          <ErrorState error={failed.error} onRetry={() => queries.forEach((q) => void q.refetch())} />
        ) : queries.some((q) => q.isPending) || groupsPending ? (
          <PageSpinner />
        ) : isEmpty ? (
          <EmptyList view={view} onAdd={add} />
        ) : (
          <>
            {visible.map((s, i) => (
              <section key={s.group?.id ?? s.title ?? i} className="section">
                {s.group ? (
                  <div className="section-header">
                    <h2 className="section-title">{s.title}</h2>
                    <Link
                      to={`/gruppi/${s.group.id}/storico/nuovo${view === 'esterno' || view === 'interno' ? `?vista=${view}` : ''}`}
                      className="section-action"
                      aria-label={`Registra un intervento per il gruppo «${s.title}»`}
                    >
                      <ClipboardPlus size={16} aria-hidden="true" /> Registra
                    </Link>
                  </div>
                ) : (
                  s.title && <h2 className="section-title">{s.title}</h2>
                )}
                <RowList items={s.items} editing={editing} onDelete={setToDelete} />
              </section>
            ))}
            {needsBonsai && bonsai.length > 0 && (
              <button type="button" className="btn btn-plain btn-block list-footer-action" onClick={() => setGroupsSheet(true)}>
                <Folders size={18} aria-hidden="true" /> Gestisci gruppi
              </button>
            )}
          </>
        )}
      </div>

      {account && <AccountSheet onClose={() => setAccount(false)} />}
      {groupsSheet && <GroupsSheet onClose={() => setGroupsSheet(false)} />}
      {addMenu && (
        <Dialog title="Aggiungi" onClose={() => setAddMenu(false)}>
          <div className="action-list">
            <Link to="/bonsai/nuovo" className="action-item">
              <TreeDeciduous size={22} aria-hidden="true" /> Aggiungi Bonsai
            </Link>
            <Link to="/strumenti/nuovo" className="action-item">
              <Hammer size={22} aria-hidden="true" /> Aggiungi Strumento
            </Link>
          </div>
          <button type="button" className="btn btn-plain btn-block" onClick={() => setAddMenu(false)}>
            Annulla
          </button>
        </Dialog>
      )}
      {toDelete && (
        <ConfirmDialog
          title={`Eliminare «${toDelete.name}»?`}
          message={`${toDelete.kind === 'bonsai' ? 'Il bonsai, le sue foto e i promemoria' : 'Lo strumento e le sue foto'} verranno eliminati definitivamente.`}
          busy={deleteBonsai.isPending || deleteTool.isPending}
          error={deleteError}
          onConfirm={() => void confirmDelete()}
          onCancel={() => {
            setToDelete(null);
            setDeleteError('');
          }}
        />
      )}
    </>
  );
}

function EmptyList({ view, onAdd }: { view: TabView; onAdd: () => void }) {
  const copy: Record<TabView, { title: string; text: string; action: string }> = {
    tutti: { title: 'Il tuo giardino è vuoto', text: 'Aggiungi il tuo primo bonsai o uno strumento.', action: 'Aggiungi' },
    esterno: { title: 'Nessun bonsai da esterno', text: 'I bonsai che vivono all’aperto appariranno qui.', action: 'Aggiungi Bonsai' },
    interno: { title: 'Nessun bonsai da interno', text: 'I bonsai che vivono in casa appariranno qui.', action: 'Aggiungi Bonsai' },
    strumenti: { title: 'Nessuno strumento', text: 'Substrati, concimi, attrezzi e accessori appariranno qui.', action: 'Aggiungi Strumento' },
  };
  const c = copy[view];
  return (
    <EmptyState icon={view === 'strumenti' ? Hammer : TreeDeciduous} title={c.title} text={c.text}>
      <button type="button" className="btn btn-primary" onClick={onAdd}>
        <Plus size={18} aria-hidden="true" /> {c.action}
      </button>
    </EmptyState>
  );
}

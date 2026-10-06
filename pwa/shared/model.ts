// Domain model shared by the React app and the Netlify functions.
// Mirrors BonsaiRecord / ToolsSupplementsRecord from the original iOS app.

export const MONTHS = [
  'Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno',
  'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre',
] as const;

export const MONTH_INITIALS = ['G', 'F', 'M', 'A', 'M', 'G', 'L', 'A', 'S', 'O', 'N', 'D'] as const;

export const BONSAI_CATEGORIES = ['esterno', 'interno'] as const;
export type BonsaiCategory = (typeof BONSAI_CATEGORIES)[number];

export const BONSAI_CATEGORY_LABELS: Record<BonsaiCategory, string> = {
  esterno: 'Bonsai Esterno',
  interno: 'Bonsai Interno',
};

export const TOOL_TYPES = ['substrato', 'concime', 'attrezzo', 'accessorio'] as const;
export type ToolType = (typeof TOOL_TYPES)[number];

/** Types known to the first release: older app versions crash on any other, so they only get these. */
export const LEGACY_TOOL_TYPES: readonly ToolType[] = ['substrato', 'attrezzo', 'accessorio'];

export const TOOL_TYPE_LABELS: Record<ToolType, string> = {
  substrato: 'Substrati',
  concime: 'Concimi',
  attrezzo: 'Attrezzi',
  accessorio: 'Accessori',
};

export const CARE_KEYS = ['repotting', 'pruning', 'shootCutting', 'wiring', 'defoliation', 'fertilizing'] as const;
export type CareKey = (typeof CARE_KEYS)[number];

export interface CareSectionConfig {
  key: CareKey;
  title: string;
  /** Label of the "last done" date, for sections that track one. */
  dateLabel?: string;
  /** Label of the extra free-text field (fertilizer type). */
  extraLabel?: string;
}

/** The six care sections of the iOS form, in the same order. */
export const CARE_SECTIONS: readonly CareSectionConfig[] = [
  { key: 'repotting', title: 'Rinvaso', dateLabel: 'Ultimo Rinvaso' },
  { key: 'pruning', title: 'Potatura' },
  { key: 'shootCutting', title: 'Taglio Germogli' },
  { key: 'wiring', title: 'Applicazione Filo', dateLabel: 'Ultima Applicazione' },
  { key: 'defoliation', title: 'Defogliazione' },
  { key: 'fertilizing', title: 'Concimazione', extraLabel: 'Tipologia di Concime' },
];

export interface CareSection {
  /** 0 = Gennaio … 11 = Dicembre; null when not set. */
  startMonth: number | null;
  endMonth: number | null;
  notes: string;
  /** ISO date (YYYY-MM-DD), only for sections with a `dateLabel`. */
  lastDate?: string | null;
  /** Only for sections with an `extraLabel`. */
  fertilizerType?: string;
}

export type BonsaiCare = Record<CareKey, CareSection>;

export interface Photo {
  id: string;
  width: number | null;
  height: number | null;
}

export const FREQUENCY_UNITS = ['giorni', 'settimane', 'mesi', 'anni'] as const;
export type FrequencyUnit = (typeof FREQUENCY_UNITS)[number];

/** Singular and plural label of each unit: "ogni 1 anno", "ogni 3 settimane". */
export const FREQUENCY_UNIT_LABELS: Record<FrequencyUnit, readonly [string, string]> = {
  giorni: ['giorno', 'giorni'],
  settimane: ['settimana', 'settimane'],
  mesi: ['mese', 'mesi'],
  anni: ['anno', 'anni'],
};

/** How often a care task is done, e.g. Concimazione every 3 weeks. */
export interface CareFrequency {
  every: number;
  unit: FrequencyUnit;
  /** Create a reminder for the next time whenever the task is recorded in the diary. */
  autoReminder: boolean;
}

export type BonsaiSchedule = Partial<Record<CareKey, CareFrequency>>;

export interface Bonsai {
  id: string;
  name: string;
  category: BonsaiCategory;
  substrate: string;
  pot: string;
  care: BonsaiCare;
  groupId: string | null;
  schedule: BonsaiSchedule;
  /** Photos of the tree itself; photos of diary entries come with the entries. */
  photos: Photo[];
  createdAt: string;
  updatedAt: string;
}

export interface BonsaiInput {
  name: string;
  category: BonsaiCategory;
  substrate: string;
  pot: string;
  care: BonsaiCare;
  /** Omitted = keep the stored value (older app versions do not send it). */
  groupId?: string | null;
  /** Omitted = keep the stored value (older app versions do not send it). */
  schedule?: BonsaiSchedule;
  photoIds: string[];
}

export interface BonsaiGroup {
  id: string;
  name: string;
  position: number;
}

/** What a diary entry records: one of the six care tasks, or a free observation. */
export const EVENT_KINDS = [...CARE_KEYS, 'observation'] as const;
export type EventKind = (typeof EVENT_KINDS)[number];

export const EVENT_KIND_LABELS: Record<EventKind, string> = {
  repotting: 'Rinvaso',
  pruning: 'Potatura',
  shootCutting: 'Taglio Germogli',
  wiring: 'Applicazione Filo',
  defoliation: 'Defogliazione',
  fertilizing: 'Concimazione',
  observation: 'Osservazione',
};

export const FERTILIZER_FORMS = ['solido', 'liquido'] as const;
export type FertilizerForm = (typeof FERTILIZER_FORMS)[number];

export const FERTILIZER_FORM_LABELS: Record<FertilizerForm, string> = { solido: 'Solido', liquido: 'Liquido' };

/** Extra fields of an entry: Rinvaso { mix, pot }, Concimazione { product, form, dose }. */
export interface CareEventDetails {
  mix?: string;
  pot?: string;
  product?: string;
  form?: FertilizerForm | null;
  dose?: string;
}

/** A Strumenti item used by an entry; `toolId` is null once the item was deleted from the catalog. */
export interface CareEventTool {
  toolId: string | null;
  name: string;
}

export interface CareEvent {
  id: string;
  bonsaiId: string;
  kind: EventKind;
  /** YYYY-MM-DD */
  date: string;
  notes: string;
  details: CareEventDetails;
  tools: CareEventTool[];
  photos: Photo[];
  /** Shared by the entries recorded for a whole group at once. */
  batchId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CareEventFields {
  kind: EventKind;
  date: string;
  notes: string;
  details: CareEventDetails;
  tools: CareEventTool[];
  photoIds: string[];
}

/** Reminder for the next time, created together with an entry (replaces the previous automatic one). */
export interface NextReminder {
  bonsaiId: string;
  remindAt: string;
  message: string;
}

export interface CareEventCreateInput extends CareEventFields {
  /** One tree, or every tree of a group (then without photos). */
  bonsaiIds: string[];
  nextReminders: NextReminder[];
}

export interface CareEventSuggestions {
  mix: string[];
  pot: string[];
  product: string[];
  dose: string[];
}

export interface Tool {
  id: string;
  name: string;
  type: ToolType;
  genre: string;
  seller: string;
  price: string;
  links: string;
  details: string;
  photos: Photo[];
  createdAt: string;
  updatedAt: string;
}

export interface ToolInput {
  name: string;
  type: ToolType;
  genre: string;
  seller: string;
  price: string;
  links: string;
  details: string;
  photoIds: string[];
}

export interface Reminder {
  id: string;
  bonsaiId: string;
  message: string;
  remindAt: string;
  sentAt: string | null;
  /** Set when created automatically from the frequency of a care task. */
  careKind: CareKey | null;
  createdAt: string;
}

export interface User {
  id: string;
  email: string;
}

/** The "Novità" message of this release, shown once per account. */
export const CURRENT_ANNOUNCEMENT = 'novita-v2';

export function emptyCareSection(config: CareSectionConfig): CareSection {
  return {
    startMonth: null,
    endMonth: null,
    notes: '',
    ...(config.dateLabel ? { lastDate: null } : {}),
    ...(config.extraLabel ? { fertilizerType: '' } : {}),
  };
}

export function emptyCare(): BonsaiCare {
  return Object.fromEntries(CARE_SECTIONS.map((s) => [s.key, emptyCareSection(s)])) as BonsaiCare;
}

/** Months covered by a start→end range, wrapping around the year end (e.g. Nov → Feb). */
export function monthsInRange(start: number | null, end: number | null): number[] {
  if (start == null && end == null) return [];
  if (start == null) return [end!];
  if (end == null) return [start];
  const out: number[] = [];
  for (let m = start; ; m = (m + 1) % 12) {
    out.push(m);
    if (m === end) break;
  }
  return out;
}

export function formatMonthRange(start: number | null, end: number | null): string {
  if (start == null && end == null) return '';
  if (start == null || end == null || start === end) return MONTHS[(start ?? end)!];
  return `${MONTHS[start]} – ${MONTHS[end]}`;
}

/** Local calendar date as YYYY-MM-DD. */
export function toIsoDate(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function parseIsoDate(value: string): Date {
  const [y, m, d] = value.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/** `date` + one frequency interval; month steps are clamped (31 Jan + 1 month = 28/29 Feb). */
export function addFrequency(date: string, { every, unit }: Pick<CareFrequency, 'every' | 'unit'>): string {
  const d = parseIsoDate(date);
  if (unit === 'giorni' || unit === 'settimane') {
    d.setDate(d.getDate() + every * (unit === 'settimane' ? 7 : 1));
    return toIsoDate(d);
  }
  const months = every * (unit === 'anni' ? 12 : 1);
  const target = new Date(d.getFullYear(), d.getMonth() + months, 1);
  const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  target.setDate(Math.min(d.getDate(), lastDay));
  return toIsoDate(target);
}

export function formatFrequency({ every, unit }: Pick<CareFrequency, 'every' | 'unit'>): string {
  const [one, many] = FREQUENCY_UNIT_LABELS[unit];
  if (every === 1) return unit === 'settimane' ? 'ogni settimana' : `ogni ${one}`;
  return `ogni ${every} ${many}`;
}

export interface CareHistory {
  /** Dates of the task, newest first (diary entries plus the date saved in the card, if any). */
  dates: string[];
  last: string | null;
  /** Average days between two consecutive times, when done at least twice. */
  averageDays: number | null;
  /** From the frequency, when set. */
  nextDue: string | null;
}

/** Summary of one care task from the diary (and the "last done" date of the card, if older data has one). */
export function careHistory(events: Pick<CareEvent, 'kind' | 'date'>[], kind: CareKey, legacyDate: string | null | undefined, frequency?: CareFrequency): CareHistory {
  const dates = [...new Set([...events.filter((e) => e.kind === kind).map((e) => e.date), ...(legacyDate ? [legacyDate] : [])])].sort().reverse();
  const last = dates[0] ?? null;
  let averageDays: number | null = null;
  if (dates.length > 1) {
    const span = (parseIsoDate(dates[0]).getTime() - parseIsoDate(dates.at(-1)!).getTime()) / 86_400_000;
    averageDays = Math.round(span / (dates.length - 1));
  }
  return { dates, last, averageDays, nextDue: last && frequency ? addFrequency(last, frequency) : null };
}

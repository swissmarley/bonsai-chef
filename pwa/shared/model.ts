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

export const TOOL_TYPES = ['substrato', 'attrezzo', 'accessorio'] as const;
export type ToolType = (typeof TOOL_TYPES)[number];

export const TOOL_TYPE_LABELS: Record<ToolType, string> = {
  substrato: 'Substrati',
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

export interface Bonsai {
  id: string;
  name: string;
  category: BonsaiCategory;
  substrate: string;
  pot: string;
  care: BonsaiCare;
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
  photoIds: string[];
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
  createdAt: string;
}

export interface User {
  id: string;
  email: string;
}

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

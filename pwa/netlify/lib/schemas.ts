import { z } from 'zod';
import {
  BONSAI_CATEGORIES,
  CARE_KEYS,
  CARE_SECTIONS,
  EVENT_KINDS,
  FERTILIZER_FORMS,
  FREQUENCY_UNITS,
  TOOL_TYPES,
  emptyCare,
  toIsoDate,
  type BonsaiCare,
  type BonsaiSchedule,
  type CareEventDetails,
  type CareKey,
  type CareSection,
  type EventKind,
} from '../../shared/model';
import { msg } from './http';

const text = (max: number) => z.string().trim().max(max, msg(`Testo troppo lungo (massimo ${max} caratteri).`)).default('');
const name = z.string().trim().min(1, msg('Il nome è obbligatorio.')).max(120, msg('Il nome è troppo lungo.'));
const month = z.number().int().min(0).max(11).nullable().default(null);
const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, msg('Data non valida.'))
  .refine((v) => !Number.isNaN(Date.parse(v)), msg('Data non valida.'))
  .nullable()
  .default(null);
const MAX_REMINDER_AHEAD_MS = 5 * 365 * 24 * 60 * 60 * 1000;
const photoIds = z.array(z.uuid()).max(30, msg('Puoi aggiungere al massimo 30 foto.')).default([]);

const careSection = z.object({
  startMonth: month,
  endMonth: month,
  notes: text(5000),
  lastDate: isoDate.optional(),
  fertilizerType: text(200).optional(),
});

const care = z
  .object({
    repotting: careSection.prefault({}),
    pruning: careSection.prefault({}),
    shootCutting: careSection.prefault({}),
    wiring: careSection.prefault({}),
    defoliation: careSection.prefault({}),
    fertilizing: careSection.prefault({}),
  } satisfies Record<CareKey, unknown>)
  .prefault({});

/** Keeps only the fields each care section actually has (date / fertilizer type). */
export function normalizeCare(input: Partial<Record<string, Partial<CareSection>>> | null | undefined): BonsaiCare {
  const base = emptyCare();
  for (const config of CARE_SECTIONS) {
    const s = input?.[config.key];
    if (!s) continue;
    base[config.key] = {
      startMonth: s.startMonth ?? null,
      endMonth: s.endMonth ?? null,
      notes: s.notes ?? '',
      ...(config.dateLabel ? { lastDate: s.lastDate ?? null } : {}),
      ...(config.extraLabel ? { fertilizerType: s.fertilizerType ?? '' } : {}),
    };
  }
  return base;
}

const frequency = z.object({
  every: z
    .number(msg('Indica ogni quanto si ripete.'))
    .int(msg('La frequenza deve essere un numero intero.'))
    .min(1, msg('La frequenza deve essere almeno 1.'))
    .max(365, msg('La frequenza è troppo grande.')),
  unit: z.enum(FREQUENCY_UNITS, msg('Scegli giorni, settimane, mesi o anni.')),
  autoReminder: z.boolean().default(false),
});

const schedule = z.object(Object.fromEntries(CARE_KEYS.map((key) => [key, frequency.optional()])) as Record<CareKey, z.ZodOptional<typeof frequency>>);

/** Stored schedules are read leniently: an invalid entry is dropped, the others are kept. */
export function normalizeSchedule(value: unknown): BonsaiSchedule {
  const out: BonsaiSchedule = {};
  if (!value || typeof value !== 'object') return out;
  for (const key of CARE_KEYS) {
    const parsed = frequency.safeParse((value as Record<string, unknown>)[key]);
    if (parsed.success) out[key] = parsed.data;
  }
  return out;
}

export const bonsaiSchema = z.object({
  name,
  category: z.enum(BONSAI_CATEGORIES, msg('Scegli una categoria valida.')),
  substrate: text(300),
  pot: text(300),
  care,
  // No defaults: older app versions do not send these, and then the stored values are kept.
  groupId: z.uuid(msg('Gruppo non valido.')).nullable().optional(),
  schedule: schedule.optional(),
  photoIds,
});

export const groupSchema = z.object({
  name: z.string().trim().min(1, msg('Il nome del gruppo è obbligatorio.')).max(60, msg('Il nome del gruppo è troppo lungo.')),
});

export const groupOrderSchema = z.object({
  ids: z.array(z.uuid()).max(500),
});

const eventDate = z
  .string(msg('Indica la data.'))
  .regex(/^\d{4}-\d{2}-\d{2}$/, msg('Data non valida.'))
  .refine((v) => !Number.isNaN(Date.parse(v)) && v >= '1900-01-01', msg('Data non valida.'))
  // One day of tolerance for time zones ahead of the server's.
  .refine((v) => v <= toIsoDate(new Date(Date.now() + 86_400_000)), msg('La data non può essere nel futuro.'));

const eventDetails = z
  .object({
    mix: text(500).optional(),
    pot: text(300).optional(),
    product: text(200).optional(),
    form: z.enum(FERTILIZER_FORMS, msg('Scegli solido o liquido.')).nullable().optional(),
    dose: text(100).optional(),
  })
  .prefault({});

/** Keeps only the extra fields of the entry's kind (Rinvaso: miscela, vaso; Concimazione: prodotto, forma, dose). */
export function normalizeDetails(kind: EventKind, details: CareEventDetails | null | undefined): CareEventDetails {
  const d = details ?? {};
  if (kind === 'repotting') return { mix: d.mix ?? '', pot: d.pot ?? '' };
  if (kind === 'fertilizing') return { product: d.product ?? '', form: d.form ?? null, dose: d.dose ?? '' };
  return {};
}

const eventFields = {
  kind: z.enum(EVENT_KINDS, msg('Scegli il tipo di intervento.')),
  date: eventDate,
  notes: text(5000),
  details: eventDetails,
  tools: z
    .array(
      z.object({
        toolId: z.uuid().nullable(),
        name: z.string().trim().min(1).max(200),
      }),
    )
    .max(20, msg('Puoi collegare al massimo 20 strumenti.'))
    .default([]),
  photoIds,
};

export const eventUpdateSchema = z.object(eventFields);

export const eventCreateSchema = z
  .object({
    ...eventFields,
    bonsaiIds: z
      .array(z.uuid(msg('Bonsai non valido.')))
      .min(1, msg('Scegli almeno un bonsai.'))
      .max(500)
      .transform((ids) => [...new Set(ids)]),
    nextReminders: z
      .array(
        z.object({
          bonsaiId: z.uuid(msg('Bonsai non valido.')),
          remindAt: z.iso
            .datetime({ offset: true, message: msg('Data del promemoria non valida.') })
            .refine((v) => Date.parse(v) > Date.now() - 60_000, msg('La data del promemoria deve essere nel futuro.'))
            .refine((v) => Date.parse(v) < Date.now() + MAX_REMINDER_AHEAD_MS, msg('La data del promemoria è troppo lontana.')),
          message: text(500),
        }),
      )
      .max(500)
      .default([]),
  })
  .refine((v) => v.bonsaiIds.length === 1 || v.photoIds.length === 0, msg('Le foto si aggiungono a un bonsai alla volta.'))
  .refine((v) => v.nextReminders.every((r) => v.bonsaiIds.includes(r.bonsaiId)), msg('Promemoria per un bonsai non incluso.'))
  .refine((v) => v.kind !== 'observation' || v.nextReminders.length === 0, msg('Le osservazioni non hanno promemoria.'));

export const feedbackSchema = z.object({
  message: z.string().trim().min(1, msg('Scrivi un messaggio.')).max(5000, msg('Il messaggio è troppo lungo (massimo 5000 caratteri).')),
});

export const toolSchema = z.object({
  name,
  type: z.enum(TOOL_TYPES, msg('Scegli una tipologia valida.')),
  genre: text(300),
  seller: text(300),
  price: text(100),
  links: text(5000),
  details: text(5000),
  photoIds,
});

export const reminderSchema = z.object({
  bonsaiId: z.uuid(msg('Bonsai non valido.')),
  message: text(500),
  remindAt: z.iso
    .datetime({ offset: true, message: msg('Data e ora non valide.') })
    .refine((v) => Date.parse(v) > Date.now() - 60_000, msg('La data del promemoria deve essere nel futuro.'))
    .refine((v) => Date.parse(v) < Date.now() + MAX_REMINDER_AHEAD_MS, msg('La data del promemoria è troppo lontana.')),
});

export const pushSubscriptionSchema = z.object({
  endpoint: z.url({ protocol: /^https$/, message: msg('Sottoscrizione non valida.') }).max(1000),
  keys: z.object({
    p256dh: z.string().min(1).max(200),
    auth: z.string().min(1).max(100),
  }),
});

import { z } from 'zod';
import {
  BONSAI_CATEGORIES,
  CARE_SECTIONS,
  TOOL_TYPES,
  emptyCare,
  type BonsaiCare,
  type CareKey,
  type CareSection,
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

export const bonsaiSchema = z.object({
  name,
  category: z.enum(BONSAI_CATEGORIES, msg('Scegli una categoria valida.')),
  substrate: text(300),
  pot: text(300),
  care,
  photoIds,
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

const MAX_REMINDER_AHEAD_MS = 5 * 365 * 24 * 60 * 60 * 1000;

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

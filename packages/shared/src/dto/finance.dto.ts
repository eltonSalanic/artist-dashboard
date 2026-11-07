import { z } from 'zod';
import { FinanceKinds, FinanceStates, type FinanceKind, type FinanceState } from '../enums';
import {
  FinanceCategoryKeys,
  categoryKind,
  type Balances,
  type LedgerTotals,
} from '../finance';

/** $10M — far past any band's single line, well inside a Postgres int. */
export const MAX_AMOUNT_CENTS = 1_000_000_000;

const amountCents = z.number().int().min(1).max(MAX_AMOUNT_CENTS);
const isoDate = z.iso.date();

const entryFields = {
  kind: z.enum(FinanceKinds),
  category: z.enum(FinanceCategoryKeys),
  amountCents,
  occurredOn: isoDate,
  counterparty: z.string().trim().max(200).nullish(),
  description: z.string().trim().max(2_000).optional(),
  note: z.string().trim().max(2_000).optional(),
  /**
   * Expenses only: the member who paid out of pocket, so the band owes them.
   * Null is the band's account. Ignored for income.
   */
  handledById: z.uuid().nullish(),
};

const categoryMatchesKind = (e: { kind?: FinanceKind; category?: string }) =>
  !e.kind || !e.category || categoryKind(e.category) === e.kind;
const categoryMessage = {
  message: 'That category belongs to the other kind of entry',
  path: ['category'],
};

export const createFinanceEntrySchema = z
  .object({
    ...entryFields,
    /** Only show fees and other promised income can be EXPECTED. */
    state: z.enum(['EXPECTED', 'SETTLED']).default('SETTLED'),
    eventId: z.uuid().nullish(),
  })
  .refine(categoryMatchesKind, categoryMessage)
  .refine((e) => e.state === 'SETTLED' || e.kind === 'INCOME', {
    message: 'Only income can be expected',
    path: ['state'],
  });
export type CreateFinanceEntryDto = z.infer<typeof createFinanceEntrySchema>;

export const updateFinanceEntrySchema = z
  .object({
    ...entryFields,
    counterparty: z.string().trim().max(200).nullable(),
    handledById: z.uuid().nullable(),
    eventId: z.uuid().nullable(),
    /** Marking expected money as received. Voiding has its own route. */
    state: z.enum(['EXPECTED', 'SETTLED']),
  })
  .partial()
  .refine(categoryMatchesKind, categoryMessage);
export type UpdateFinanceEntryDto = z.infer<typeof updateFinanceEntrySchema>;

export const financeEntryQuerySchema = z.object({
  /** Inclusive `YYYY-MM-DD`. */
  from: isoDate.optional(),
  /** Inclusive `YYYY-MM-DD`. */
  to: isoDate.optional(),
  kind: z.enum(FinanceKinds).optional(),
  category: z.enum(FinanceCategoryKeys).optional(),
  eventId: z.uuid().optional(),
  includeVoid: z
    .enum(['true', 'false'])
    .transform((v) => v === 'true')
    .optional(),
});
export type FinanceEntryQueryDto = z.infer<typeof financeEntryQuerySchema>;

export const financeSummaryQuerySchema = z.object({
  from: isoDate.optional(),
  to: isoDate.optional(),
});
export type FinanceSummaryQueryDto = z.infer<typeof financeSummaryQuerySchema>;

/**
 * What happens to a member's money when an admin removes them from the band.
 * Their past entries always stay as they are; `payBack` pays back everything
 * the band still owes them, in the same step.
 */
export const removeMemberSchema = z
  .object({
    payBack: z.boolean().optional(),
  })
  .default({});
export type RemoveMemberDto = z.infer<typeof removeMemberSchema>;

// ---- Responses ----

export interface FinanceMemberRef {
  id: string;
  displayName: string;
}

export interface FinanceEntryDto {
  id: string;
  boardId: string;
  kind: FinanceKind;
  state: FinanceState;
  category: string;
  amountCents: number;
  /** `YYYY-MM-DD` */
  occurredOn: string;
  counterparty: string | null;
  description: string;
  note: string;
  eventId: string | null;
  eventTitle: string | null;
  handledById: string | null;
  createdById: string | null;
  /** When an admin paid the member back for this out-of-pocket expense. */
  paidBackAt: string | null;
  /** The admin who paid it back. */
  paidBackById: string | null;
  receiptCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface FinanceSummaryDto {
  currency: string;
  /** Totals for the requested range. */
  totals: LedgerTotals;
  /** All-time, regardless of range: who is owed what right now. */
  balances: Balances;
  members: FinanceMemberRef[];
  /** Out-of-pocket expenses not paid back yet, all time, newest first. */
  owed: FinanceEntryDto[];
}

export interface ShowSettlementDto {
  currency: string;
  event: { id: string; title: string; startsAt: string };
  entries: FinanceEntryDto[];
  incomeCents: number;
  expenseCents: number;
  netCents: number;
  expectedCents: number;
  /** Today's members plus anyone these entries mention, for names and pickers. */
  members: FinanceMemberRef[];
}

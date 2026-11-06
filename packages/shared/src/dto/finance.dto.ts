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
  /** Member whose own money this went through; null is the band's account. */
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
 * An admin sends a member's out-of-pocket expense back. The note is what the
 * member reads to know what to fix, so it's worth writing, but a bare "no" is
 * still a decision.
 */
export const rejectFinanceEntrySchema = z.object({
  note: z.string().trim().max(500).default(''),
});
export type RejectFinanceEntryDto = z.infer<typeof rejectFinanceEntrySchema>;

export const createPayoutSchema = z.object({
  userId: z.uuid(),
  /** Positive: the band paid the member. Negative: the member paid the band. */
  amountCents: z
    .number()
    .int()
    .min(-MAX_AMOUNT_CENTS)
    .max(MAX_AMOUNT_CENTS)
    .refine((n) => n !== 0, 'Amount must not be zero'),
  paidOn: isoDate,
  note: z.string().trim().max(500).optional(),
});
export type CreatePayoutDto = z.infer<typeof createPayoutSchema>;

/**
 * What happens to a member's money when an admin removes them from the band.
 * Their past entries always stay as they are; `payout`, when given, records
 * the final payment that squares them up, in the same step.
 */
export const removeMemberSchema = z
  .object({
    payout: createPayoutSchema.omit({ userId: true }).optional(),
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
  /** The admin who approved a member's out-of-pocket expense, and when. */
  approvedById: string | null;
  approvedAt: string | null;
  /** Why an admin sent it back; `''` unless `state` is REJECTED. */
  decisionNote: string;
  receiptCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface PayoutDto {
  id: string;
  userId: string;
  amountCents: number;
  paidOn: string;
  note: string;
  createdById: string | null;
  createdAt: string;
}

export interface FinanceSummaryDto {
  currency: string;
  /** Totals for the requested range. */
  totals: LedgerTotals;
  /** All-time, regardless of range: who is owed what right now. */
  balances: Balances;
  members: FinanceMemberRef[];
  /** Members' out-of-pocket expenses waiting for an admin, all time, newest first. */
  pending: FinanceEntryDto[];
  /**
   * Expenses an admin sent back that the caller logged, newest first — the
   * member's to-do list. Admins see every sent-back entry.
   */
  sentBack: FinanceEntryDto[];
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

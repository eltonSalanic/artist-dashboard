import { z } from 'zod';
import { FinanceKinds, FinanceStates, type FinanceKind, type FinanceState } from '../enums';
import {
  FinanceCategoryKeys,
  SPLIT_EXIT_MODES,
  categoryKind,
  isValidSplit,
  type Balances,
  type LedgerTotals,
  type SplitShare,
} from '../finance';

/** $10M — far past any band's single line, well inside a Postgres int. */
export const MAX_AMOUNT_CENTS = 1_000_000_000;

const amountCents = z.number().int().min(1).max(MAX_AMOUNT_CENTS);
const isoDate = z.iso.date();

export const splitShareSchema = z.object({
  /** Null is the band fund. */
  userId: z.uuid().nullable(),
  shareBps: z.number().int().min(0).max(10_000),
});

const splitSchema = z
  .array(splitShareSchema)
  .min(1)
  .max(50)
  .refine((shares) => isValidSplit(shares), {
    message: 'Shares must add up to 100%, with nobody listed twice',
  });

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
  /** Overrides the board's default split for this one entry. */
  splits: splitSchema.optional(),
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

export const updateSplitSchema = z.object({ shares: splitSchema });
export type UpdateSplitDto = z.infer<typeof updateSplitSchema>;

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
 * Their past entries always stay as they are. `split` decides where their
 * slice of the saved split goes (only matters when a split was saved: the
 * equal default re-divides by itself); `payout`, when given, records the
 * final payment that squares them up, in the same step.
 */
export const removeMemberSchema = z
  .object({
    split: z.enum(SPLIT_EXIT_MODES).default('SPREAD'),
    payout: createPayoutSchema.omit({ userId: true }).optional(),
  })
  .default({ split: 'SPREAD' });
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
  splits: SplitShare[];
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

export interface FinanceSplitDto {
  shares: SplitShare[];
  /** True when nobody has saved a split yet and this is the equal default. */
  isDefault: boolean;
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
  /** Shows with promised income still outstanding. */
  unpaidShows: { eventId: string; title: string; startsAt: string; expectedCents: number }[];
}

export interface ShowSettlementDto {
  currency: string;
  event: { id: string; title: string; startsAt: string };
  entries: FinanceEntryDto[];
  incomeCents: number;
  expenseCents: number;
  netCents: number;
  expectedCents: number;
  cuts: { userId: string; cents: number }[];
  bandFundCents: number;
  split: SplitShare[];
  members: FinanceMemberRef[];
}

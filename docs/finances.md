# Finances — the band's books

**Status:** built on web and phone. Approvals, one-time show settling, the member-removal prompt, USD only and the phone's payouts, split editor, CSV export and reports landed on `feat/finance-improvements` (2026-11-06).

## The model

Everything lives in [apps/api/prisma/schema.prisma](../apps/api/prisma/schema.prisma); the money math is pure and shared in [packages/shared/src/finance.ts](../packages/shared/src/finance.ts), so the API, web and phone report the same cents.

- **FinanceEntry** — one ledger line. `kind` is INCOME or EXPENSE, `amountCents` is always positive (the kind gives the sign). `state`:
  - `EXPECTED` — income promised, not in hand (a show fee still owed).
  - `PENDING` — a member's own out-of-pocket expense waiting for an admin's approval. It doesn't count anywhere until approved.
  - `SETTLED` — real money; the only state balances count.
  - `VOID` — replaces delete, so the books never lose a row.
  - Links: the show (`eventId`), whose pocket it went through (`handledById`, null = the band's account), who logged it, who approved it (`approvedById`, `approvedAt`), receipts (attachments).
- **FinanceSplit** — each entry's own split in basis points (10000 = 100%), frozen when written. Null user = the band fund.
- **SplitShare** — the band's saved default split. No rows = equal shares among whoever is in the band now.
- **Payout** — money that moved between the band and a member outside the app. Positive: the band paid the member.
- **Board.currency** — always `USD`. Books are US dollars only; the column stays for a later multi-currency version, but nothing lets a band change it.

**Balance** for a member = their cut of settled income − their cut of settled expenses + what they fronted − what they collected − payouts. Positive means the band owes them. Leftover cents from rounding go to the band fund.

## Rules

| | Member | Admin |
|---|---|---|
| See ledger, balances, reports | ✓ | ✓ |
| Log an entry | Only their own pocket or the band's, default split | Any handler, custom split |
| Edit or void an entry | Only ones they logged, and not once approved | Any |
| Approve a pending expense | | ✓ |
| Split, payouts, settling a show | | ✓ |

- **Approvals.** An expense a member logs as paid from their own pocket starts `PENDING` (`needsApproval()`). An admin approves it (`POST /boards/:id/finances/entries/:entryId/approve`) or rejects it by voiding. Once approved it's locked to that member (`isLockedFor()`); admins can still fix it. Editing never approves: a member's edit keeps it pending, and turning an existing entry into your own out-of-pocket expense sends it back for approval. Income a member collected skips approval, since it means they owe the band.
- **Settling a show** sends a `requestId` (`newRequestId()`, made once per opening of the form). Each line is stored with the unique `settleKey` `<requestId>:<index>`, so the same request twice (a double tap, a retry) writes the night once, even when both copies race. Expected fees flip to settled only while still `EXPECTED`, inside the transaction, and a settle that changed nothing isn't logged.
- **Removing a member** (`DELETE /boards/:id/members/:userId`) takes an optional body (`removeMemberSchema`): `split` is `SPREAD` (the default: their slice of the saved split is shared among everyone left in proportion, so 4 × 25% becomes 3 × 33.33%) or `FUND` (it goes to the band fund); `payout` records the final payment that squares them up, in the same transaction. Their past entries never change. With no saved split nothing needs moving: equal shares re-divide by themselves. Web asks in a dialog with their balance; the phone asks in a short run of alerts.

## Where it shows

- **Web** `/finances`: period totals, "Waiting for approval" (admins approve from it), shows still owing with Settle, who's owed with member history and payouts, the split editor, the ledger with filters and CSV export, reports by category, month and show.
- **Phone** Finances spoke: the same totals, waiting for approval, shows still owing, who's owed (members who owe the band too) with member history, "Record a payment" and deleting a payment, how money is split with "Edit split" for admins, by month and by category, and the entries with filters and "Export CSV" through the share sheet. Forms: `form/finance`, `form/settle`, `form/payout?member=…`, `form/split`.

## Not done yet

- The activity log doesn't record edits, voids, approvals, split changes or payout deletes, and payouts are hard-deleted. Under discussion.
- Ledger paging, keeping payouts when an account is deleted (they cascade today), and expected fees dated after today in "This month".

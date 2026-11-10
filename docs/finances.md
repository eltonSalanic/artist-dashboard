# Finances — the band's books

**Status:** built on web and phone. The books are a ledger: income and expenses, and members are owed only for what they paid out of pocket, until an admin pays them back. Paying back (with push and inbox alerts, undo, and a lock once paid back), the member overview, searchable "All entries", the member-removal prompt, USD only, CSV export and reports are on `feat/finance-improvements` (2026-11-07). Approvals, recorded payments ("payouts"), settling a show, the "Shows still owing" list and splits were all removed on that branch.

## The model

Everything lives in [apps/api/prisma/schema.prisma](../apps/api/prisma/schema.prisma); the money math is pure and shared in [packages/shared/src/finance.ts](../packages/shared/src/finance.ts), so the API, web and phone report the same cents.

- **FinanceEntry** — one ledger line. `kind` is INCOME or EXPENSE, `amountCents` is always positive (the kind gives the sign). `state`:
  - `EXPECTED` — income promised, not in hand (a show fee still owed).
  - `SETTLED` — real money. Everything a member logs counts at once.
  - `VOID` — replaces delete, so the books never lose a row.
  - `handledById` — **expenses only**: the member who paid out of their own pocket. Null is the band's account. Always null for income (there is no "who has the money"; put that in the note).
  - `paidBackAt`, `paidBackById` — when and by which admin the member was paid back.
  - Also: the show (`eventId`), who logged it (`createdById`), receipts (attachments).
- **Board.currency** — always `USD`. The column stays for a later multi-currency version, but nothing lets a band change it.

**Owed back / Paid back.** An out-of-pocket expense (`isOutOfPocket()`: an expense with `handledById`) is *Owed back* until an admin pays it back, then *Paid back* (`paybackStatus()`, `PAYBACK_LABELS`). Income and band-account expenses carry no label.

**Balances** (`computeBalances()`), all time, from settled entries:

- Per member: `paidCents` (everything they paid out of pocket), `paidBackCents`, `owedCents` (paid − paid back).
- `owedCents` — what the band owes everyone together.
- `bandFundCents` — the band's own money: income, less band-account expenses, less what it paid members back. It can go below zero; paying back before the band has the money is allowed.

There is no split and no "member owes the band": profit stays with the band.

## Rules

| | Member | Admin |
|---|---|---|
| See ledger, balances, reports | ✓ | ✓ |
| Log an entry | Paid by themselves or the band account | Paid by anyone |
| Edit or void an entry | Expenses they paid, or band-account entries they logged | Any |
| Pay back, pay back all, undo a payback | | ✓ |

`canEditEntry()` is the rule both apps and the API use. **Once paid back, nobody can edit or void the entry**, admins included, so it can't drift from what was paid; an admin undoes the payback first.

- **Paying back.** `POST /boards/:id/finances/entries/:entryId/pay-back` pays one expense back; `POST …/members/:userId/pay-back` pays back everything a member is owed; `POST …/entries/:entryId/undo-pay-back` takes one back. Band Wall doesn't move money: it records that the band paid them.
- **Who hears about it.** When an expense becomes owed (logged, or edited into someone's pocket), every admin except the payer and whoever logged it gets an inbox row (`MentionNotification`, kind `PAYBACK`) and a push + email (`expense-owed`, category `APPROVALS`, labelled "Paybacks" in settings). An edit refreshes the rows without another push. Paying back drops those rows and gives the member one `PAID_BACK` row and one `expense-paid-back` push for the lot, and logs `EXPENSE_PAID_BACK` in the activity feed. Undo removes the member's row and brings the admins' rows back quietly. Tapping a row opens the expense (or Finances, for a pay-back-all).
- **Summary.** `GET …/finances/summary` returns the period totals, all-time `balances`, and `owed`: every expense still owed back, newest first.
- **There is no "settle show" step.** A show's money is ordinary entries tied to the show; an expected fee is marked received by editing it.
- **Removing a member** (`DELETE /boards/:id/members/:userId`) takes an optional body (`removeMemberSchema`): `{ payBack: true }` pays back everything the band still owes them, in the same transaction. Their past entries never change. Web asks in the dialog; the phone asks in an alert ("Pay back now" / "Leave it owed").

## Where it shows

- **Phone** (the focus):
  - Finances spoke, laid out like a banking app: a dark card with the band fund in big type, the period switch (this month / this year / all time) and money in (green), money out (red) and net (the phone uses its own slightly deeper greens and reds for money everywhere, in `apps/mobile/src/theme/money-colors.ts`, rather than the web's `FINANCE_COLORS`); **Add expense** and **Add income** under it; then three tabs. **Entries** (where it opens): every entry as a timeline, with search, quick filter chips (type, owed or paid back, the band account, each member), a filter sheet (type, who paid, category, paid back, min/max amount, sort, reset), the count with CSV export, then month by month with each month's in, out and net, split by day: each day has a slim header with its date and, when it has more than one entry, that day's net (and what's expected). Sorted by amount it's one list without day headers, and every row shows its own date. **Owed** ("Spotlight"): a grid of faces at the top, four to a row and wrapping onto more rows, "Everyone" first, then each member, most owed first. A face the band owes has a red ring and the amount on a tab under it; a square face has a tick (green when they've been paid back, grey when they never paid for anything); the viewer is marked "(you)". Tapping a face spotlights them in the panel below without leaving the tab: what the band owes them (or "Square"), paid for the band / paid back / still owed, their expenses not paid back yet (tap to open one) and "Open full statement" for their member page. "Everyone" (where it opens) shows what the band owes in all, then every expense still to pay back, one card per person (tap their name to spotlight them), and who is square. **Overview**: what the band owes members, By category, Month by month.
  - **All entries** screen (`/board/:id/finances/entries`): the same timeline full-screen, with the search and quick filters pinned at the top. Search covers what it was for, note, who was paid, show and category.
  - **Member page** (`/board/:id/finances/member/:userId`): a centred hero with their face, name and what the band owes them (or a big "Square"), then Paid for the band, Paid back and Still owed as three tiles, "Pay back all" for admins (with a confirm), and every expense they paid with an Owed back / Paid back label. Over the list: an Owed back / Paid back / All switch (it opens on Owed back when anything is owed), search, and category and amount filters with Reset, and the result count. Tapping an expense opens its form. On your own page it says "you" and "your".
  - Expense form (`form/finance`): the label and a sentence on where it stands, "Pay {name} back $x" and "Undo pay back" for admins, locked once paid back. "Who paid" is shown for expenses only.
  - The Finances chip and hub card show what admins have to pay back; a member's card shows what they're owed.
- **Web** `/finances`: the same model with less polish: an "Owed back" card with Pay back buttons, "Who's owed" with Pay back all and each member's expenses (Pay back / Undo per expense), the ledger with search, who paid, paid-back and other filters, CSV export, and reports.

## Test data

`npm run db:seed:finances -w apps/api` builds "Velvet Static" (`apps/api/prisma/seed-finances.ts`), a band with five real logins, all on one test password that the script prints:

| Login | Role | Set up to try |
| --- | --- | --- |
| riley@bandwall.test | Owner, admin | Paying back; was paid back for posters; "owed back" reminders in the inbox |
| casey@bandwall.test | Admin | A second admin; was paid back for ads and gas |
| jamie@bandwall.test | Member | Owed for a van tire and drum heads |
| avery@bandwall.test | Member | Paid back for the motel, still owed for a dinner |
| quinn@bandwall.test | Member | Owed for a keyboard stand; try removing them |

It covers about three months of income and expenses across every category, one voided duplicate, a played show whose fee is still expected, and an upcoming expected fee. The owner gets a promotional subscription, so it works with `BILLING_ENFORCED=true`. Reruns rebuild that band and reset the five passwords.

The main demo seed (`npm run db:seed`) also writes a small ledger into "Neon Harbor", but its bandmates can't log in.

## Not done yet

- The activity log doesn't record edits, voids or undone paybacks.
- Ledger paging, and expected fees dated after today in "This month".

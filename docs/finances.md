# Finances — the band's books

**Status:** built on web and phone. Approvals (with send-back notes, push, email and inbox), the member-removal prompt, USD only and the phone's payouts, CSV export and reports landed on `feat/finance-improvements` (2026-11-06). Settling a show, the "Shows still owing" list and splits were removed the same day.

## The model

Everything lives in [apps/api/prisma/schema.prisma](../apps/api/prisma/schema.prisma); the money math is pure and shared in [packages/shared/src/finance.ts](../packages/shared/src/finance.ts), so the API, web and phone report the same cents.

- **FinanceEntry** — one ledger line. `kind` is INCOME or EXPENSE, `amountCents` is always positive (the kind gives the sign). `state`:
  - `EXPECTED` — income promised, not in hand (a show fee still owed).
  - `PENDING` — a member's own out-of-pocket expense waiting for an admin's approval. It doesn't count anywhere until approved.
  - `REJECTED` — an admin sent it back, with a note in `decisionNote`. It doesn't count either; the member fixes it and saves, which makes it `PENDING` again.
  - `SETTLED` — real money; the only state balances count.
  - `VOID` — replaces delete, so the books never lose a row.
  - Links: the show (`eventId`), whose pocket it went through (`handledById`, null = the band's account), who logged it, who approved it (`approvedById`, `approvedAt`), receipts (attachments).
- **Payout** — money that moved between the band and a member outside the app. Positive: the band paid the member.
- **Board.currency** — always `USD`. Books are US dollars only; the column stays for a later multi-currency version, but nothing lets a band change it.

**There is no split.** The books record what came in, what went out, and whose pocket it went through; profit stays with the band. The **band fund** is all-time settled income minus settled expenses.

**Balance** for a member = what they fronted − what they collected − payouts, from settled entries. Positive means the band owes them. (Before 2026-11-06 balances also included each member's split of the net; the `drop_splits` migration removed the split tables.)

## Rules

| | Member | Admin |
|---|---|---|
| See ledger, balances, reports | ✓ | ✓ |
| Log an entry | Only their own pocket or the band's | Any handler |
| Edit or void an entry | Only ones they logged, and not once approved | Any |
| Approve a pending expense, or send it back | | ✓ |
| Payouts | | ✓ |

- **Approvals.** An expense a member logs as paid from their own pocket starts `PENDING` (`needsApproval()`). An admin approves it (`POST /boards/:id/finances/entries/:entryId/approve`) or sends it back with a note (`POST …/reject`, body `{ note }`), which makes it `REJECTED`; a sent-back entry can still be approved outright. Once approved it's locked to that member (`isLockedFor()`); admins can still fix it. Editing never approves: a member's edit keeps it pending, saving a sent-back entry resubmits it (clearing the note), and turning an existing entry into your own out-of-pocket expense sends it for approval. Income a member collected skips approval, since it means they owe the band.
- **Who hears about it.** When an entry lands `PENDING`, every other admin gets an inbox row (`MentionNotification`, kind `APPROVAL`) and a push + email (`expense-approval`, category `APPROVALS`). A member's edit while pending refreshes the rows without another push; a resubmit after a send-back is a fresh request and does push. On approve or send-back the admins' rows go and the member gets a `DECISION` row and `expense-decided`. Tapping any of these opens Finances. The summary's `pending` (all, newest first) and `sentBack` (the caller's own, or all for an admin) feed the "Waiting for approval" and "Sent back" sections; the phone shows the count on the Finances tab chip and hub card.
- **There is no "settle show" step.** A show's money is ordinary entries tied to the show: an expected fee is marked received by editing it, and the night's merch, gas and door cut are added as entries whenever.
- **Removing a member** (`DELETE /boards/:id/members/:userId`) takes an optional body (`removeMemberSchema`): `payout` records the final payment that squares them up, in the same transaction. Their past entries never change. Web asks in a dialog with their balance; the phone asks in an alert.

## Where it shows

- **Web** `/finances`: period totals, "Waiting for approval" (receipt, show, note and how long it has waited; admins approve or send back with a note from it), "Sent back", who's owed with member history and payouts, the ledger with filters and CSV export, reports by category, month and show.
- **Phone** Finances spoke, one card per group with a sentence-case title (Overview, Waiting for approval, Sent back, Who's owed, Month by month, By category, Entries): the same totals, waiting for approval (admins swipe right to approve, left to send back), sent back, who's owed (members who owe the band too) with member history, "Record a payment" and deleting a payment, by month and by category, and the entries with filters and "Export CSV" through the share sheet. Forms: `form/finance`, `form/reject?id=…`, `form/payout?member=…`.

## Test data

`npm run db:seed:finances -w apps/api` builds "Velvet Static" (`apps/api/prisma/seed-finances.ts`), a band with five real logins, all on one test password that the script prints:

| Login | Role | Set up to try |
| --- | --- | --- |
| riley@bandwall.test | Owner, admin | Approving or sending back, payouts; two approval requests in the inbox |
| casey@bandwall.test | Admin | A second admin: the same two requests |
| jamie@bandwall.test | Member | Pending expenses: the $50 van tire and drumsticks |
| avery@bandwall.test | Member | Fronted the motel, partly paid back; a dinner Riley sent back with a note |
| quinn@bandwall.test | Member | Has held merch cash; try removing them |

It covers about three months of income and expenses across every category, settled shows, one voided duplicate, a played show whose fee is still expected, an upcoming expected fee, and payouts both ways. The owner gets a promotional subscription, so it works with `BILLING_ENFORCED=true`. Reruns rebuild that band and reset the five passwords.

The main demo seed (`npm run db:seed`) also writes a small ledger into "Neon Harbor", but its bandmates can't log in.

## Not done yet

- The activity log doesn't record edits, voids, approvals or payout deletes, and payouts are hard-deleted. Under discussion.
- Ledger paging, keeping payouts when an account is deleted (they cascade today), and expected fees dated after today in "This month".

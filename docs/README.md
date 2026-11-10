# Band Wall — Feature Documentation

Reference docs for *what the product does* and the rules behind it, one file per
feature area. This is the behavioural spec: what fires when, who can do what,
and which edge cases were decided deliberately.

For the module map and stack overview read the root [README.md](../README.md);
for build conventions and skills read [CLAUDE.md](../CLAUDE.md). Those describe
*how we build*. These describe *what we built*.

## Conventions for this directory

- **One file per feature area**, named after the area (`notifications.md`,
  `permissions.md`). Cross-link rather than repeat.
- **Document decisions, not code.** If a reader can get it from the type
  signature, leave it out. If someone would reasonably ask "why does it do
  that?", write it down.
- **Mark what isn't built yet.** A spec written ahead of the code is useful; a
  spec that silently lies about what ships is not. Use a status line.
- **Keep the trigger/permission tables authoritative.** When behaviour changes,
  the table changes in the same PR.

## Contents

| Area | Status |
|---|---|
| [Plans](plans/README.md) — implementation plans, kept in the repo and openable in Obsidian, with Trello links | Live — show statuses complete, tours in draft |
| [Notifications](notifications.md) — every trigger, recipient, channel, and suppression rule | Email and push shipped; no push-only preferences yet |
| [Mobile app](mobile-app.md) — the Expo/React Native app: phase tracker, navigation design, locked decisions | In progress — P0–P13 and P17 done; P14 and P18 not started |
| [Release workflow](release-workflow.md) — dev → staging → prod, EAS builds and updates, TestFlight and Play beta, migrations | Guide; staging/prod hosting, EAS Update and store submission not set up yet |
| [Environments](environments.md) — what `APP_ENV` and `NODE_ENV` change in the API, web and phone apps, with the code that reads them | Checked against the code 2026-11-10 |
| [Error handling and logging](error-handling.md) — error shape, user-facing copy, dev vs staging/prod logs, Sentry | Built; Sentry off until DSNs are set |
| [Onboarding](onboarding.md) — the first run on phone and web: welcome, account, naming the band, the paywall, "You're live", the setup checklist, joining with an invite | Merged into `main` (2026-11-02); the sign-up email code is on `feat/email-verification` |
| [Billing — subscriptions](billing.md) — subscriptions through RevenueCat (a person's subscription lets them own a band), the 402 rule, webhook mapping, env vars, account setup | In `main`, not live: no hosting, store products or `BILLING_ENFORCED` yet; manual testing on Trello |
| [File storage](storage.md) — where attachments live, the `ObjectStorage` interface, Supabase and R2 providers, size caps per file type, R2 setup | Done: interface, caps, compression and thumbnails on `main`; R2 buckets and tokens set up, CORS on staging and prod to add; copying existing files not needed yet |
| Permissions — the `can()` map, role matrix, and where each action is enforced | Not yet written |
| Tasks — statuses, subtasks, assignees, checklists, ordering | Not yet written |
| Planning — goals, events, reminders, focus pins, calendar | Not yet written |
| Dashboard — the widget grid, personal vs. default layouts, the widget registry | Not yet written |
| Comments & attachments — markdown, mentions, the signed-URL upload flow | Not yet written |
| Archive — the two-tier archive/delete model and its cascade rules | Not yet written |
| Board appearance — palettes and per-widget colour slots | Not yet written |
| [Finances](finances.md) — ledger, paying members back, member overview, search, removing a member, USD only | Built on web and phone; paybacks, the member overview and All entries on `feat/finance-improvements` |
| Show statuses — per-band show steps, categories, cancelled filtering | Not yet written; see the [plan](plans/show-statuses.md) |
| Links on items — named web links on tasks, events, goals and reminders | Not yet written |

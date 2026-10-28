# Show statuses

> **State:** Testing
> **Updated:** 2026-10-27
> **Task ID prefix:** `SHOW`
> **Source:** New

## Goal

Let a band say where each show stands, from a hold on a date to a show that
was played, and let each band add its own steps (for example "Advanced" or
"Contract sent") the same way it already customises task statuses. Today a
`SHOW` event is just a date, a title and a place: nothing says whether it is
pencilled in, confirmed, played or called off, so a cancelled show either sits
on the calendar looking real or gets deleted along with its notes and money.

## How task statuses work today (the model to copy)

- `TaskStatus` is a per-board table: `name`, `color`, `sortOrder`, `isDone`.
  Every task has a required `statusId`.
- New boards get `DEFAULT_TASK_STATUSES` from
  `packages/shared/src/statuses.ts` (Not Started, In Progress, Waiting, Done)
  via `apps/api/src/boards/new-board.ts`.
- `apps/api/src/statuses` serves `GET/POST/PATCH/DELETE
  /boards/:boardId/statuses`. Listing is open to members; editing is
  admin-only (`status.manage`). Delete is refused while any task uses the
  status, and a board always keeps at least one.
- `isDone` is the only meaning the app reads from a status: completion, the
  "finish open subtasks" cascade, digests. Names and colours are free.
- Admins edit them in Settings (`statuses-card.tsx` on web,
  `board-settings.tsx` on the phone); members change a task's status with
  `task.changeStatus` (the phone's `status-sheet.tsx`).

Show statuses follow the same shape: a per-board table of named, coloured,
ordered statuses, seeded with defaults, editable by admins. The one
difference is that a show status needs a little more meaning than "done or
not", so it carries a **category** instead of a boolean.

## Suggested default statuses

| Order | Name | Colour | Category | Means |
|---|---|---|---|---|
| 0 | **Hold** | grey `#8b8fa3` | `HOLD` | Date pencilled in or offered, not locked. |
| 1 | **Details pending** | amber `#f5a623` | `BOOKED` | The show is on, but set time, load-in, pay or contacts are still missing. |
| 2 | **Confirmed** | green `#2fbf71` | `BOOKED` | Booked and every detail is in. Ready to play. |
| 3 | **Cancelled** | red `#e5484d` | `CANCELLED` | Called off. Kept for the record, hidden from counts. |

Why these four: they follow how a show actually firms up (offered, agreed,
fully sorted) plus the one exit, and they use Elton's own "confirmed" and
"details pending". "Played" is deliberately **not** a status: a booked show
whose date has passed is shown as played automatically, so nobody has to go
back and tick it. Custom statuses fill the gaps a band cares about, such as
"Offer sent" (`HOLD`) or "Advanced" (`BOOKED`). "Settled" is not a status either: settlement
already lives in the finances module (`settleShow`, entry `state`), so the UI
shows a "Settled" badge from the ledger instead of asking the band to keep two
things in sync.

## Scope and decisions

### In scope

- A per-board, user-editable list of show statuses with the four defaults.
- Every `SHOW` event has a status; other event types (meeting, rehearsal) do
  not.
- Change a show's status from the event dialog, event detail and calendar on
  web and phone.
- Admins add, rename, recolour, reorder and delete statuses in Settings,
  next to task statuses.
- The app reads the category: cancelled shows drop out of counts and
  notifications; holds look tentative; booked shows past their date read as
  played and get nudged towards settling.
- Filter shows by status on the calendar and events views.

### Out of scope (for this plan)

- Statuses on meetings and rehearsals.
- Automatic status changes. "Played" is a display state derived from the
  date, not a status write; everything else the app only nudges about.
- Per-status task templates ("when a show goes Confirmed, add these tasks").
  See recommendations.
- Tour statuses. The Tours plan keeps `TourStatus` as a fixed enum; see
  "Compatibility with Tours".

### Decisions and constraints

1. **Separate table, not a shared one with task statuses.** `ShowStatus`
   mirrors `TaskStatus` instead of adding a `kind` column to it. The two lists
   mean different things, are edited separately, and this leaves every
   existing task query and `isDone` check untouched.
2. **Category, not `isDone`.** `ShowStatusCategory` is a fixed enum: `HOLD`,
   `BOOKED`, `CANCELLED`. A custom status picks one, so the app always knows
   how to treat it. Names and colours stay free. Played is not a category:
   a `HOLD` or `BOOKED` show whose date has passed is shown as played.
3. **Only shows have a status.** `Event.showStatusId` is nullable, with a
   CHECK constraint: `type <> 'SHOW' OR "showStatusId" IS NOT NULL`. Changing
   an event to `SHOW` requires a status (the API fills the default); changing
   it away from `SHOW` clears it.
4. **New shows start in the board's first non-cancelled status** by
   `sortOrder` (Hold, with the defaults). The create dialog lets you pick
   another.
5. **Deleting a status** is refused while shows use it, like task statuses.
   A board must keep at least one non-`CANCELLED` status, so new shows always
   have somewhere to start. Foreign key uses `onDelete: Restrict`.
6. **Backfill:** the migration seeds the four defaults on every existing
   board, then puts every existing show in Confirmed. A band that was already
   tracking shows on the calendar meant them, and past ones read as played.
7. **Permissions** go through the shared `can()` map. Editing the list reuses
   `status.manage` (admin). Changing a show's status gets a new action,
   `show.changeStatus`, granted to members as well as admins, matching
   `task.changeStatus`: whoever got the set time from the promoter can move
   the show from Details pending to Confirmed.
   Editing any other show field stays under `event.manage`.
8. **Activity:** new `ActivityType` `SHOW_STATUS_CHANGED`, written on every
   change, with text in `packages/shared/src/activity-text.ts`.

## Data model

```prisma
enum ShowStatusCategory {
  HOLD
  BOOKED
  CANCELLED
}

model ShowStatus {
  id        String             @id @default(uuid()) @db.Uuid
  boardId   String             @db.Uuid
  name      String
  color     String
  sortOrder Int
  category  ShowStatusCategory
  createdAt DateTime           @default(now())
  board     Board              @relation(fields: [boardId], references: [id], onDelete: Cascade)
  events    Event[]

  @@index([boardId])
}
```

| Table | Change |
|---|---|
| `Board` | `showStatuses ShowStatus[]` |
| `Event` | `showStatusId String? @db.Uuid`, relation `onDelete: Restrict`, indexed; CHECK from decision 3 |
| `ActivityType` | `SHOW_STATUS_CHANGED` |

## What the category drives

| Category | Calendar and lists | Counts and roll-ups | Notifications | Nudges |
|---|---|---|---|---|
| `HOLD` | Dashed outline, "Hold" pill | Counted as upcoming, labelled tentative | Day-of summary still sent, marked "on hold" | 14 days out: "Still a hold, confirm it?"; after the date: "Did this happen?" |
| `BOOKED` | Normal; past dates show a "Played" pill | Counted (upcoming, then played) | Normal | A week out and still a status other than the last `BOOKED` one: "Details still pending". After the date and unsettled: "Settle this show" |
| `CANCELLED` | Struck through, hidden by default filter | Excluded everywhere | None (day-of summary skipped) | On cancel with expected income: offer to void it |

## API

- **New `show-statuses` module** (`apps/api/src/show-statuses`), shaped like
  `statuses`: `GET/POST/PATCH/DELETE /boards/:boardId/show-statuses`.
  Create/update DTOs carry `category`. Spec covers the in-use and
  last-non-cancelled guards.
- **Events:** `showStatusId` on create/update; the service fills the default
  when a show has none and clears it for non-shows. New `PATCH
  /boards/:boardId/events/:eventId/status` guarded by `show.changeStatus`, so
  members can change status without `event.manage`. `eventQuerySchema` gains
  `showStatusId` and `includeCancelled` (default false for lists, true for the
  archive and the event's own page).
- **Board payload:** `showStatuses` next to `statuses`, so both apps get them
  with the board like task statuses.
- **Roll-ups that count shows** (upcoming shows, day-of notification, calendar
  feed) filter out `CANCELLED`.
- **Finances:** cancelling a show that has `EXPECTED` income returns those
  entries so the UI can offer to void them. No automatic money changes.
- Jest unit specs alongside each service, Prisma mocked.

## Web (`apps/web`)

- **Settings:** a "Show statuses" card beside "Task statuses". Generalise
  `statuses-card.tsx` so both cards share rows (name, colour, reorder,
  delete), with a category select instead of the "Counts as done" checkbox.
- **Event dialog:** status select when the type is Show.
- **Event detail / show money view:** status pill that opens a picker, plus
  the derived "Settled" badge from finances.
- **Calendar and upcoming-shows widget:** status styling from the table
  above; a status filter with "Hide cancelled" on by default.

## Phone (`apps/mobile`)

- **Board settings:** show statuses list mirroring task statuses.
- **Event detail:** status pill opening a sheet; generalise `status-sheet.tsx`
  to take a list and an onPick, so tasks and shows share it.
- **Calendar and lists:** same styling and "Hide cancelled" filter.

## Compatibility with Tours

The Tours plan ([tours.md](tours.md)) stays as written; this plan slots under
it.

- **Tour roll-ups** (show count, next show, tour net, date fallback from first
  to last show) exclude `CANCELLED` shows. Holds count but show as tentative,
  so a tour in `PLANNING` with only holds reads honestly.
- **Tour status nudges** can read show categories: "All shows confirmed, mark
  the tour booked?" and "Every show's date has passed, mark it wrapped?". `TourStatus`
  remains a fixed enum.
- **Tours recommendation 2** (per-show "Confirmed → Advanced → Played →
  Settled") is covered by this plan: Advanced becomes a custom status, Played
  comes from the date and Settled from finances.
- **Order:** either plan can land first. If Tours lands first, add the
  cancelled filter to its roll-ups in SHOW-004; if this lands first, TOUR-003
  and TOUR-004 use the filter from the start. Both migrations touch `Event`,
  so they ship as separate migrations, not edits to one.

## Tasks

| ID | Task | State | Trello card |
|---|---|---|---|
| SHOW-001 | Schema and migration: `ShowStatusCategory`, `ShowStatus`, `Event.showStatusId`, CHECK constraint, seed defaults and backfill existing shows, `SHOW_STATUS_CHANGED` | Testing | [Show statuses testing](https://trello.com/c/YyHbu8qz) |
| SHOW-002 | Shared: `DEFAULT_SHOW_STATUSES`, show status DTOs, `showStatusId` on event DTOs and query, `show.changeStatus` permission, activity text | Testing | [Show statuses testing](https://trello.com/c/YyHbu8qz) |
| SHOW-003 | API: `show-statuses` module with guards and specs; defaults on new boards; `showStatuses` on the board payload | Testing | [Show statuses testing](https://trello.com/c/YyHbu8qz) |
| SHOW-004 | API: event status endpoint, default/clear rules, cancelled filtering in lists, calendar, widgets and day-of notification; expected-income check on cancel | Testing | [Show statuses testing](https://trello.com/c/YyHbu8qz) |
| SHOW-005 | api-client: show status hooks and `useChangeShowStatus` | Testing | [Show statuses testing](https://trello.com/c/YyHbu8qz) |
| SHOW-006 | Web: shared statuses card and "Show statuses" settings card | Testing | [Show statuses testing](https://trello.com/c/YyHbu8qz) |
| SHOW-007 | Web: status in event dialog and detail, calendar styling and filter, nudges | Testing | [Show statuses testing](https://trello.com/c/YyHbu8qz) |
| SHOW-008 | Phone: show statuses in board settings; shared status sheet on event detail; calendar styling and filter | Testing | [Show statuses testing](https://trello.com/c/YyHbu8qz) |
| SHOW-009 | Demo seed: Neon Harbor shows across all four statuses, plus one custom "Advanced" status | Testing | [Show statuses testing](https://trello.com/c/YyHbu8qz) |
| SHOW-010 | Feature test pass and Trello "Show statuses testing" card | Testing | [Show statuses testing](https://trello.com/c/YyHbu8qz) |

Order: 001 → 002 → 003/004 → 005, then web (006–007) and phone (008) side by
side. 009 can land with 004.

## Verification

- [ ] A new band gets Hold, Details pending, Confirmed and Cancelled.
- [ ] Existing shows come through the migration as Confirmed, and past ones show a Played pill.
- [ ] A new show starts as Hold; a new rehearsal has no status.
- [ ] An admin adds "Advanced" (Booked category) between Details pending and Confirmed, and it appears on web and phone.
- [ ] A member can move a show to Confirmed but cannot rename statuses or edit the show's date.
- [ ] Deleting a status in use is refused with a count; deleting the last non-cancelled status is refused.
- [ ] A cancelled show is struck through, hidden by default on the calendar, missing from upcoming counts, and gets no day-of summary.
- [ ] Cancelling a show with expected income offers to void it; nothing changes without confirmation.
- [ ] A past booked show reads as Played, and once its money is settled it shows the Settled badge.
- [ ] Activity feed records each status change.

## Recommendations (not yet in scope)

1. **Status-triggered task templates.** When a show moves to Confirmed, add
   "send stage plot", "confirm guest list" and so on. Pairs well with tours.
2. **Hold expiry date.** An optional "hold until" date on Hold shows, with a
   reminder before it lapses, since venues release holds.
3. **Pipeline view.** A board-style view of shows as columns by status, for
   bands booking a lot of dates.

## Open questions

- Are Hold, Details pending, Confirmed, Cancelled the right four?
- Is showing past booked shows as "Played" automatically right, or would you
  rather mark them played by hand?
- Should members be able to change a show's status (current plan: yes, like
  tasks), or only admins?
- Should Hold shows still get the day-of summary (current plan: yes, marked
  "on hold")?

## Notes and decisions

- 2026-10-27: Draft written from the current `TaskStatus` setup and the Tours
  draft. Waiting on Elton's review before any cards or code.
- 2026-10-27: Defaults revised to use Elton's "Confirmed" and "Details
  pending". Played became a date-derived display state instead of a status,
  and the categories shrank to `HOLD`, `BOOKED`, `CANCELLED`.
- 2026-10-27: Elton approved the plan and asked for implementation. Open
  questions taken as planned: members may change a show's status, holds still
  get the day-of summary (marked on hold), and past shows read as Played
  automatically.
- 2026-10-27: Built on `feat/show-statuses`. Two deliberate differences from
  the draft: there is no day-of show summary job yet, so nothing to filter
  there; the phone calendar shows cancelled shows struck through instead of
  hiding them behind a filter. Feature test:
  https://claude.ai/artifact/WBhSaZyvzWuf2aoretE3c8

# Tours

> **State:** Draft
> **Updated:** 2026-10-27
> **Task ID prefix:** `TOUR`
> **Source:** New

## Goal

Give a band one place to run a tour. A tour groups the shows it plays, the
tasks that get it on the road, and the money it makes and spends, so the band
can see at a glance what is booked, what is still to do, and whether the run
is paying for itself.

Today everything hangs off a single show (`Event`): tasks have `eventId`,
ledger entries have `eventId`, and show settlement is per event. There is no
way to say "the van rental belongs to the whole fall run" or "book hotels for
the tour" without pinning it to an arbitrary show. Tours add that missing
level above the show.

## Scope and decisions

### In scope

- A **Tour** on a board: name, optional dates, status, colour, notes, links
  and files.
- **Shows belong to a tour.** An event gets an optional `tourId`. Any event
  type can join (a production rehearsal or a press meeting on the road counts),
  but the tour's show list and money roll-ups count `SHOW` events.
- **Tasks attach to a tour directly or through a show.** A task can point at
  a show (as now) or straight at a tour, so "book the van" does not have to be
  tied to a date.
- **Money attaches to a tour directly or through a show.** Tour-wide costs
  (van, gas, hotels, merch run) go on the tour; show fees and per-show costs
  stay on the show and roll up.
- **Filter by tour** in the tasks list, the finance ledger and the calendar.
- A **tour page** on web and phone: overview, shows, tasks, money, notes and
  files.
- Archive a tour together with its shows and tasks, and restore them together,
  using the existing `archivedWithId` cascade.

### Out of scope (for this plan)

- Routing, mileage and maps.
- Day sheets per show (load-in, set time, hotel, promoter contact). See
  recommendations; this is the natural next plan.
- Merch inventory.
- Sharing a tour outside the board (crew, agent, promoter links).

### Decisions and constraints

1. **A show belongs to at most one tour.** `Event.tourId` is a nullable FK with
   `onDelete: SetNull`, so deleting a tour never deletes its shows.
2. **Tour membership of a task or entry is derived, not copied.** A task is "on
   the tour" when `task.tourId = X` **or** `task.event.tourId = X`. Same for
   finance entries. We do not write the tour id onto show tasks, so moving a
   show to another tour moves its tasks and money with it and nothing drifts.
3. **A task or entry carries either a show or a tour, not both.** If `eventId`
   is set, `tourId` stays null and the tour comes from the show. The API clears
   `tourId` when a show is picked, and the pickers present it as one choice:
   "Tour-wide" or one of the tour's shows. This keeps decision 2 honest.
   Enforced with a CHECK constraint in the migration, like `Note`.
4. **Dates are optional and fall back to the shows.** `startsOn` / `endsOn`
   are `@db.Date` and nullable. When empty, the UI shows the range from the
   first to the last attached event. Explicit dates let a band plan a tour
   before any show is confirmed.
5. **Status is a small enum:** `PLANNING`, `BOOKED`, `ON_THE_ROAD`, `WRAPPED`.
   `ON_THE_ROAD` and `WRAPPED` could be computed from dates, but bands move
   tours around and want to say "booked" themselves, so it is stored. The UI
   can nudge ("This tour's last show was 3 days ago, mark it wrapped?").
6. **Permissions** go through the shared `can()` map. New action
   `tour.manage` (create, edit, archive, attach/detach shows), admin-only like
   `event.manage`. Viewing a tour is open to every member. Attaching a task or
   entry to a tour follows the existing task and finance rules, so a member who
   may log an expense may log it against a tour.
7. **Tour settlement reuses show settlement math.** Tour money = tour-wide
   entries + entries of the tour's shows. Cuts and band fund use the same split
   logic in `packages/shared/src/finance.ts`, so a tour total and the sum of
   its shows can never disagree.
8. **Notes, links and files on a tour** extend the existing polymorphic tables
   (`Note`, `ItemLink`, `Attachment`) with a `tourId` column and widen their
   exactly-one-parent CHECK constraints. No new note/link/file systems.

## Data model

```prisma
enum TourStatus {
  PLANNING
  BOOKED
  ON_THE_ROAD
  WRAPPED
}

model Tour {
  id         String     @id @default(uuid()) @db.Uuid
  boardId    String     @db.Uuid
  name       String
  status     TourStatus @default(PLANNING)
  /// Optional; the UI falls back to the first and last attached event.
  startsOn   DateTime?  @db.Date
  endsOn     DateTime?  @db.Date
  /// A palette slot (`WidgetColor`), so a tour reads the same on the calendar
  /// in both apps.
  color      String?
  archivedAt DateTime?
  createdAt  DateTime   @default(now())
  updatedAt  DateTime   @updatedAt
  board          Board          @relation(fields: [boardId], references: [id], onDelete: Cascade)
  events         Event[]
  tasks          Task[]
  financeEntries FinanceEntry[]
  notes          Note[]
  links          ItemLink[]
  attachments    Attachment[]

  @@index([boardId, startsOn])
  @@index([boardId, archivedAt])
}
```

Added columns (all nullable, `onDelete: SetNull` unless noted, each indexed):

| Table | Column | Notes |
|---|---|---|
| `Event` | `tourId` | The show's tour. |
| `Task` | `tourId` | Tour-wide task. CHECK: not both `eventId` and `tourId`. |
| `FinanceEntry` | `tourId` | Tour-wide money. CHECK: not both `eventId` and `tourId`. |
| `Note` | `tourId` | `onDelete: Cascade`; widen the one-parent CHECK. |
| `ItemLink` | `tourId` | `onDelete: Cascade`; widen the one-parent CHECK. |
| `Attachment` | `tourId` | `onDelete: Cascade`. |

`Task.archivedWithId` already has no FK on purpose, so it can point at a tour
too. New `ActivityType` values: `TOUR_CREATED`, `TOUR_STATUS_CHANGED`.

## API

- **New `tours` module** (`apps/api/src/tours`):
  - `GET /boards/:id/tours` with roll-ups per tour: show count, next show,
    open task count, net money (respects `finance.view`).
  - `GET /boards/:id/tours/:tourId` with shows, derived date range and counts.
  - `POST`, `PATCH`, archive/restore through the existing archive service
    (cascade to the tour's events and their tasks, plus tour-wide tasks).
  - `POST /boards/:id/tours/:tourId/events` and `DELETE …/events/:eventId` to
    attach and detach shows in bulk (handy when a band creates the tour after
    booking the dates).
- **Events:** `tourId` on create/update DTOs; `eventQuerySchema` gains `tourId`.
- **Tasks:** `tourId` on create/update; `taskQuerySchema` gains `tourId` which
  matches both direct and through-show tasks (decision 2), plus an optional
  `tourScope: 'direct' | 'all'` for the tour page's "tour-wide only" toggle.
- **Finances:** `tourId` on entry DTOs and `financeEntryQuerySchema`;
  `GET finances/tours/:tourId` returns a `TourSettlementDto`: totals, expected
  income still owed, cuts, band fund, and a per-show breakdown with a
  "Tour-wide" row.
- **Archive and calendar:** archive list learns the `TOUR` kind; calendar
  items carry `tourId` and the tour's colour so both apps can draw the tour.
- Jest unit specs alongside each service, Prisma mocked, as the repo requires.

## Web (`apps/web`)

- **`/tours`** page: cards for upcoming and current tours (status pill, date
  range, shows booked, open tasks, net), past tours collapsed below.
- **`/tours/[tourId]`** page with sections:
  - Overview: dates, status, a strip of the tour's days with shows and gaps.
  - Shows: list in date order with each show's settle state; attach existing
    shows or create a new one pre-filled with the tour.
  - Tasks: the existing tasks table filtered by tour, grouped "Tour-wide" then
    by show.
  - Money: tour settlement (reuse `show-money.tsx` pieces), per-show
    breakdown, add a tour-wide entry.
  - Notes, links, files: reuse the existing item notes / links / attachments
    components.
- **Pickers:** a tour select in the event dialog; a combined "Tour or show"
  picker in the task modal and the finance entry dialog.
- **Filters:** tour filter on the tasks table and the finance ledger.
- **Calendar:** a thin coloured band across a tour's days in the month grid.
- **Shell:** a Tours entry in the nav.

## Phone (`apps/mobile`)

- Tours reachable from the board hub (a Tours row, not a new tab, to keep the
  four tabs).
- `tour-detail.tsx` screen mirroring web's sections as stacked cards.
- Tour picker on event create/edit; "Tour or show" picker on task and finance
  entry forms; tour filter on task and ledger lists.
- Event detail shows "Part of <tour>" linking to the tour.
- Calendar shows the tour band.

## Tasks

| ID | Task | State | Trello card |
|---|---|---|---|
| TOUR-001 | Schema and migration: `Tour`, `tourId` on Event/Task/FinanceEntry/Note/ItemLink/Attachment, CHECK constraints, activity types | Planned | — |
| TOUR-002 | Shared: tour DTOs, `tourId` on event/task/finance DTOs and queries, `tour.manage` permission, tour settlement math in `finance.ts` | Planned | — |
| TOUR-003 | API: `tours` module (CRUD, roll-ups, attach/detach shows) with specs | Planned | — |
| TOUR-004 | API: tour filter and derived membership in tasks, events, finances; tour settlement endpoint; archive cascade; calendar `tourId` | Planned | — |
| TOUR-005 | api-client: tour hooks and `tourId` params on existing hooks | Planned | — |
| TOUR-006 | Web: `/tours` list and `/tours/[tourId]` page | Planned | — |
| TOUR-007 | Web: tour pickers in event, task and entry dialogs; tour filter on tasks table and ledger | Planned | — |
| TOUR-008 | Web: tour band on the calendar; nav entry | Planned | — |
| TOUR-009 | Phone: tours list and tour detail screen | Planned | — |
| TOUR-010 | Phone: pickers, filters, "Part of tour" on event detail, calendar band | Planned | — |
| TOUR-011 | Demo seed: one tour on "Neon Harbor" with shows, tour-wide tasks and money | Planned | — |
| TOUR-012 | Feature test pass and Trello "Tours testing" card | Planned | — |

Order: 001 → 002 → 003/004 → 005, then web (006–008) and phone (009–010) can
run side by side. 011 can land with 004 to give the UIs real data.

## Verification

- [ ] Create a tour, attach three existing shows, and see the date range fill in.
- [ ] Add a tour-wide task and a show task; filtering tasks by the tour shows both.
- [ ] Move a show to a different tour; its tasks and money follow it.
- [ ] Log a van rental on the tour; tour net = tour-wide entries + show entries, and matches the sum of the per-show breakdown.
- [ ] Picking a show on a task or entry clears the tour-wide choice, and vice versa.
- [ ] Archive the tour; its shows and tasks archive with it and restore together.
- [ ] Delete a tour; shows, tasks and money remain, just untoured.
- [ ] A member (not admin) can view the tour and log an expense against it, but cannot edit the tour.
- [ ] Phone and web show the same tour, colours and totals.

## Recommendations (not yet in scope)

Ranked by how much they would help a band on the road:

1. **Day sheets per show.** Load-in, soundcheck, set time, curfew, venue
   contact, hotel, parking. Today these end up in notes. Structured fields
   would feed a "Today" card on the phone and the existing day-of show
   notification. Best follow-up plan.
2. **Advance checklist per show.** A per-show status (Confirmed → Advanced →
   Played → Settled) and a reusable task template ("send stage plot", "confirm
   guest list") stamped onto each show in the tour with one tap.
3. **Tour budget vs actual.** An optional budget per tour (and per category)
   with a bar on the Money section, so the band sees overspend early.
4. **Tour widget.** A "Current tour" dashboard card: next show, days left,
   open tasks, tour net. Cheap once TOUR-004 exists; could be pulled into
   this plan.
5. **Off days and travel days** as an event type (`TRAVEL` / `OFF`), so the
   tour strip shows the whole run, not just show nights.
6. **Tour notifications.** "Tour starts in 7 days, 4 tasks open" digest,
   using the existing outbox and `SCHEDULE` category.
7. **Per-member tour payout view.** "What each of us made on this tour",
   built from the cuts in TOUR-002.

## Open questions

- Should non-admin members be able to create tours, or only admins (current
  plan: admins, like shows)?
- Is a show-or-tour-but-not-both rule right for tasks, or do you want a show
  task to also be pinned tour-wide?
- Pull the Tour widget (recommendation 4) into this plan?

## Notes and decisions

- 2026-10-27: Draft written from the current schema (events, tasks, band
  finances after PR #2). Waiting on Elton's review before any cards or code.

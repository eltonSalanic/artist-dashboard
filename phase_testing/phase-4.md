# Phase 4 — Events, Goals, Focus, Reminders, Calendar

Sign-off checklist. Phase 4 is complete when every box below is ticked (or consciously waived).

**Scope:** four planning primitives (Goals, Events, Focus, Reminders), task↔goal/event linking, five new dashboard widgets, and a month calendar that aggregates all of it.

---

## 0. Environment

- [x] Docker Desktop running, then `supabase start`
- [x] `npm run dev` — API on 3001, web on 3000
- [x] `cd apps/api && npx prisma migrate status` reports up to date (4 migrations, latest `p4_events_goals_focus_reminders`)
- [x] `npm test` passes (baseline: 35 API + 13 web)
- [x] Logged in, dashboard renders with no red errors in the browser console

---



## 1. Dashboard widgets

- [x] **Eight** widgets render: Focus, To-Do's, My Tasks, Goals, Shows, Next Rehearsals, Next Meetings, Reminders
- [x] Your Phase 3 layout survived — the three new widgets (Goals, Next Meetings, Reminders) are **appended below** your existing arrangement, not reshuffled into it
- [x] Each new widget shows a sensible **empty state** before any data exists
- [x] Resize each new widget between small and large — both collapsed and expanded forms render correctly
- [x] Hide a new widget and show it again; the change persists across a page reload
- [x] Drag-reorder still saves (debounced ~800ms) and survives reload

---



## 2. Goals

- [x] Create a goal for each period: **YEARLY**, **MONTHLY**, **DAILY**
- [x] Create one with a due date and one without
- [x] Optional description saves and displays
- [x] Edit title, description, period, and due date
- [x] Delete a goal
- [x] Goals widget lists them and reflects create/edit/delete without a manual refresh

**Completion timestamp — the subtle one:**

- [x] Mark a goal complete; it displays as completed
- [x] Un-complete it, then complete it again — the **original completion timestamp is preserved**, not overwritten
- [x] A completed goal no longer appears in the Goal picker inside the task detail modal (that list excludes completed goals by design)

---



## 3. Events

- [x] Create a **SHOW**, a **MEETING**, and a **REHEARSAL**
- [x] Each lands in its matching widget only — a SHOW appears in Shows and nowhere else
- [x] Create an event with only a start time (no end time) — saves and displays cleanly
- [x] Optional description and location save and display
- [x] Edit an event, including changing its **type** — it moves to the other widget
- [x] Delete an event
- [ ] Widgets sort by upcoming date; past events don't crowd out future ones

---



## 4. Focus

- [ ] Set a focus pin for **WEEK**, **MONTH**, and **YEAR**
- [ ] All three display in the full-width Focus strip
- [ ] Edit an existing pin — it **updates in place**; you never end up with two pins for the same period
- [ ] Clear a pin's text and confirm the empty state returns

---



## 5. Reminders

- [ ] Create reminders with several different `remindAt` times
- [ ] Toggle done on and off; state persists across reload
- [ ] Edit a reminder's title and time
- [ ] Delete a reminder
- [ ] Reminders widget orders by time
- [ ] Confirm reminders have **no detail modal** — on the calendar they are non-clickable chips. This is intended, not a gap.

---



## 6. Task linking (the headline integration)

Linking works from both directions — verify both.

**From the task detail modal:**

- [ ] Open a task, set its **Goal** via the picker; the link saves
- [ ] Set its **Event** via the picker; the link saves
- [ ] Clear each back to "no link"

**From the goal / event detail modal (**`LinkedTasks`**):**

- [ ] Linked tasks list shows the task, its status dot, and status name
- [ ] **Create** a new task directly from the goal modal — it appears already linked
- [ ] **Attach** an existing task via the picker
- [ ] **Unlink** a task — it disappears from the list but still exists on the board
- [ ] Click a linked task — the goal/event modal **swaps** to the task modal rather than stacking two modals on top of each other

**Data safety — do not skip:**

- [ ] Delete a goal that has linked tasks → the tasks **survive** with their goal link cleared
- [ ] Delete an event that has linked tasks → the tasks **survive** with their event link cleared

**Deep links:**

- [ ] `?task=<id>`, `?goal=<id>`, `?event=<id>` each open the right modal on a fresh page load
- [ ] Closing a modal removes only its own param and leaves any others intact

---



## 7. Calendar

- [ ] Calendar link appears in the sidebar and routes to `/calendar`
- [ ] Month grid renders a fixed **42 cells, Sunday-first**, with leading/trailing days greyed
- [ ] Month navigation moves forward and back correctly, including across a year boundary
- [ ] **Events** appear on their start day
- [ ] **Goal due dates** appear on the right day
- [ ] **Reminders** appear on their `remindAt` day as non-clickable chips
- [ ] **Local-time bucketing:** an event at ~11pm sits on that day, not the next. Repeat for one at ~12:30am — it must not land on the previous day.
- [ ] Clicking an event chip opens the event modal; clicking a goal chip opens the goal modal
- [ ] A day with many items degrades gracefully (no overflow past the cell)

**Plan acceptance criterion:**

- [ ] A **SHOW with an attached task** is visible on the calendar, and the attached task is reachable from it

---



## 8. Permissions

All Phase 4 mutations are **ADMIN-only**; reads are open to any board member.

- [ ] As ADMIN (your own board): every create / edit / delete above works
- [ ] Invite a second account as **USER**, then confirm they:
  - [ ] can see goals, events, focus, reminders, and the calendar
  - [ ] see **no** create/edit/delete controls in those widgets and modals
  - [ ] receive a 403 if a mutation is issued directly against the API

> If a second account isn't practical right now, waive this and note it — but the role gate stays unverified until someone does it.

---



## 9. Regression sweep (Phases 1–3 still intact)

- [ ] Login via magic link (Mailpit at [http://127.0.0.1:54324](http://127.0.0.1:54324)) still works
- [ ] Task CRUD, subtasks, checklists, and assignees unaffected
- [ ] Task reorder still works and still respects the ADMIN gate
- [ ] Statuses admin UI unaffected
- [ ] Personal layout and the admin default-layout editor in Settings both still save

---



## Known gaps — expected, not bugs

- `ACTIVITY_FEED` is listed in `DEFAULT_BOARD_LAYOUT` but has no widget implementation, so it is silently skipped. You will count eight widgets against nine layout entries.
- `CUSTOM` and `CALENDAR` widget types exist in the `WidgetType` enum with no implementation.
- **No activity logging** on any Phase 4 mutation — `ActivityService` doesn't exist yet. Phase 5 must wire logging into goals, events, focus, and reminders as well as its own modules.

---



## Sign-off

- [ ] All sections above complete or explicitly waived
- [ ] `npm test` still green
- [ ] Work committed
- [ ] `mvp-progress` memory updated to mark **P4 user-verified** and P5 as next
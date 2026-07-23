# Phase 5 — Comments, Attachments, Activity Feed, Custom Widget

Sign-off checklist. Phase 5 is complete when every box below is ticked (or consciously waived).

**Scope:** markdown comments with `@mention` autocomplete; file attachments on both tasks and comments via signed URLs; an `ActivityService` wired into every mutation across the app (P4 modules included); an Activity Feed widget with cursor pagination; and a TipTap-backed Custom "Notes" widget.

---

## 0. Environment

- [x] Docker Desktop running, then `supabase start`
- [x] `npm run dev` — API on 3001, web on 3000
- [x] `cd apps/api && npx prisma migrate status` reports up to date (7 migrations, latest `p5_comments_attachments_activity`)
- [x] `npm test` passes (baseline: **61 API + 41 web**)
- [ ] Logged in, dashboard renders with no red errors in the browser console

> **Storage note:** attachments live in the private `attachments` bucket seeded in `supabase/seed.sql`. If uploads 400/403 at the Storage step, confirm the bucket exists (Studio → Storage) — a stack started before that seed existed won't have it until `supabase db reset` or a manual bucket create.

---



## 1. Dashboard widgets

- [x] **Ten** widgets render now: the eight from P4 plus **Activity** and **Notes** (Custom)
- [x] Your existing layout survived — Activity and Notes are **appended below** your arrangement, not reshuffled into it
- [x] Both new widgets show a sensible **empty state** before any data exists
- [x] Resize each between small and large; collapsed and expanded forms both render
- [x] Hide each and show it again; the change persists across a reload
- [x] Drag-reorder still saves (debounced ~800ms) and survives reload

---



## 2. Comments — basics

Open any task's detail modal; the **Comments** section sits below Attachments.

- [x] Post a comment; it appears immediately with your name and a relative time ("just now")
- [x] **Markdown renders:** try `**bold`**, `_italic_`, a `- bullet` list, ``code``, and a plain URL (autolinked)
- [x] `Cmd/Ctrl+Enter` in the composer submits
- [x] Edit your own comment; it shows an **"· edited"** marker afterward and the body updates
- [x] Delete your own comment; it disappears
- [x] Comment count in the section header tracks create/delete

---



## 3. Comments — @mentions (the headline)

- [ ] Type `@` in the composer — a suggestion popup lists board members
- [ ] Keep typing to filter; **↑/↓** move the selection, **Enter/Tab** accepts, **Esc** dismisses
- [ ] Accepting inserts `@Name`  and drops the popup
- [ ] An email address (`sam@band.com`) in the body does **not** trigger the popup and is **not** turned into a mention
- [ ] A posted mention renders as a highlighted **chip**, not a plain link
- [ ] Two members whose names share a prefix (e.g. `sam` and `sam.jones`) each resolve to the right person — `@sam.jones` never collapses to `@sam`
- [ ] Server rejects a mention of a non-member (can't be produced from the UI; verify via direct API `POST` with a stranger's id → 400)

---



## 4. Attachments — on a task

The **Attachments** section sits above Comments in the task modal.

- [ ] Upload a **PDF** — it lists with a file icon and human-readable size
- [ ] Upload an **MP3 or WAV** — shows an audio icon
- [ ] **Download** it (click the name or the download button) — a fresh file opens/saves; the download URL is short-lived (~60s) and freshly signed each click
- [ ] Delete your own upload; it disappears from the list **and** from Storage
- [ ] A file over **50 MB** is refused before any network call, with a clear message

---



## 5. Attachments — on a comment

- [ ] Click the **paperclip** on a comment to attach a file to that specific comment
- [ ] The file lists under that comment (not in the task's Attachments section)
- [ ] Deleting the comment removes its attachments too (list is empty if you re-open; Storage objects are purged)

---



## 6. Activity Feed

Every mutation below should produce a feed entry **newest-first**. Watch the Activity widget (it refetches after each action).

Trigger and confirm each of the **eight** activity types:

- [ ] **TASK_CREATED** — create a task
- [ ] **STATUS_CHANGED** — move a task to a different status ("moved X from A to B")
- [ ] **TASK_COMPLETED** — move a task into a **done** status (fires once, alongside the status change; moving between two done columns does **not** re-fire it)
- [ ] **MEMBER_ASSIGNED** — assign someone to a task (and: a newly-invited user logging in for the first time shows "joined the board")
- [ ] **MEMBER_REMOVED** — unassign someone from a task
- [ ] **GOAL_COMPLETED** — complete a goal (re-completing an already-done goal does **not** add a second entry)
- [ ] **FILE_UPLOADED** — upload an attachment
- [ ] **COMMENT_ADDED** — post a comment

Then:

- [ ] Each entry shows the **actor's name**, an icon, and a relative time
- [ ] Clicking an entry that references a task **opens that task's modal**
- [ ] Expanded view shows **"Load more"**; it fetches the next page and the boundary between pages has **no duplicates and no gaps**
- [ ] An entry still reads correctly after its subject is renamed or deleted (the feed uses a snapshot, never a live join)

---



## 7. Custom "Notes" widget

- [ ] As **ADMIN**, open the expanded Notes widget — a toolbar (bold, italic, strike, bullet, numbered, undo/redo) sits above the editor
- [ ] Type and format text; **"Unsaved changes"** appears, then **Save** persists it
- [ ] Reload — the content is still there; the collapsed widget renders it read-only
- [ ] The empty state shows the note's title before anything is typed

---



## 8. Permissions

Reads are open to any member; the mutation gates differ by resource — verify with a second **USER** account (or waive and note it).

- [ ] **Comments:** a USER **can** post and can edit/delete **their own**; they **cannot** edit anyone else's; an ADMIN **can delete** any comment but **cannot edit** someone else's (edit is author-only, even for admins)
- [ ] **Attachments:** a USER **can** upload (it's a member-level `file.upload` action) and delete **their own**; an ADMIN can delete any
- [ ] **Custom widget:** a USER sees the note **read-only** (no toolbar, no Save); only ADMIN can edit → direct `PUT` as USER returns **403**
- [ ] **Activity feed:** a USER can **read** it
- [ ] Direct API spot-check: a USER editing another member's comment → **403**; a USER `PUT`ing the custom widget → **403**

> If a second account isn't practical right now, waive this and note it — the role gates stay unverified until someone does it.

---



## 9. Data safety

- [ ] Delete a **task** that has comments and attachments → comments and attachment rows cascade away, and their **Storage objects are purged** (no orphaned files)
- [ ] Delete a task with **subtasks** that themselves have attachments → those are cleaned up too
- [ ] An actor's feed entries survive that actor being removed (actor shows as gone/"Someone", entry text intact)

---



## 10. Regression sweep (Phases 1–4 still intact)

- [ ] Login via magic link (Mailpit) still works
- [ ] Task CRUD, subtasks, checklists, assignees, reorder unaffected
- [ ] Goals / Events / Focus / Reminders CRUD and their widgets unaffected
- [ ] Calendar still aggregates events, goal due dates, and reminders
- [ ] Task ↔ goal/event linking and deep links (`?task=`, `?goal=`, `?event=`) still work
- [ ] Personal layout and the admin default-layout editor both still save

---



## Known gaps / notes — expected, not bugs

- `CALENDAR` **widget type** remains unimplemented as a *widget* (the calendar is a full page at `/calendar`); DashboardGrid still silently skips it if present in a layout.
- **API** `npm run lint` **is red**, but it was already red on `main` before Phase 5: the strict `no-unsafe-`* rules flag the untyped Express `getRequest()` in the auth guard/decorator and the Supabase client's generics, and the ruleset even flags the `as object[]` cast that the build **requires**. This is a pre-existing project baseline, not a Phase 5 regression. `npm test` and both `build`s are green.
- **No optimistic UI** on comments/attachments — they refetch on success (consistent with the rest of the app). A brief round-trip delay on post/upload is expected.
- **Mentions don't notify** — an `@mention` highlights the person and is stored, but there's no notification/inbox system in the MVP.

---



## Sign-off

- [ ] All sections above complete or explicitly waived
- [ ] `npm test` still green (61 API + 41 web)
- [ ] Work committed
- [ ] `mvp-progress` memory updated to mark **P5 user-verified** and P6 as next
# Feature Test Checklist

Manual verification, one section per phase of [the mobile app plan](mobile-app.md).

This is **not** the phase tracker. That records what has been *built*; this
records what a person has *clicked and seen work*. A phase can be ☑ built and
still have every box here unticked.

## How to use it

- Tick a box only after seeing the behaviour yourself. An automated test
  passing is not a tick — those already run in `npm test`.
- Items marked **↻ regression** existed before the mobile work and must behave
  exactly as they did. If one of these fails, the refactor broke it.
- Items marked **★ new** are behaviour that did not exist before.
- `⊘ blocked` means it cannot be tested yet, and says what it is waiting for.
- When something fails, note it next to the box rather than silently unticking.

| Platform | Where to test |
|---|---|
| **Web** | `npm run dev` → http://localhost:3000 |
| **API** | `curl` with a bearer token, or the web UI exercising it |
| **Mobile** | a physical device running the dev client (from P5) |
| **Mail** | Mailpit at http://127.0.0.1:54324 |

---

## P1 — `packages/api-client` extraction

The whole claim of this phase is **"web behaves exactly as it did."** Every box
here is a regression check, and every one of them exercises a query hook that
physically moved files. The web test suite is only 6 files, so these matter.

### Toasts — the 12 hooks that used `sonner` now route through an injected notifier

| | Check | Expected |
|---|---|---|
| ☐ | ↻ Rename a task to something invalid / trigger any mutation error | An error toast appears, same styling and position as before |
| ☐ | ↻ Delete a task | Success toast reads "Task deleted" |
| ☐ | ↻ Archive a task, goal, event or reminder | Toast reads "Moved to the archive" |
| ☐ | ↻ Restore an item from `/archive` | Toast reads "Back on your dashboard" |
| ☐ | ↻ As admin, reset your personal layout | Toast reads "Layout reset to the board default" |
| ☐ | ↻ As admin, save the board default layout | Toast reads "Default layout saved for the board" |
| ☐ | ↻ Edit the Notes widget with the API stopped | Error toast reads "Could not save the note" |
| ☐ | ↻ Change board appearance with the API stopped | Error toast reads "Couldn't save appearance" |
| ☐ | ↻ Drag a widget with the API stopped | Error toast reads "Couldn't save layout" |

> Toast *options* were the specific risk here: the `notify` interface takes only
> a message, so any `toast.error(msg, { … })` call would have had its second
> argument silently dropped. All 16 call sites were single-argument, but these
> boxes are what confirm it.

### Data layer — each moved hook, exercised once

| | Check | Expected |
|---|---|---|
| ☐ | ↻ Sign in fresh | Board loads; `/me/bootstrap` provisions on first login |
| ☐ | ↻ Dashboard loads | All 10 widgets render with real data |
| ☐ | ↻ Check a to-do off | Ticks **immediately** (optimistic), survives a reload |
| ☐ | ↻ Drag to reorder to-dos (as admin) | Order holds after reload |
| ☐ | ↻ Change a task's status | Updates immediately; survives reload |
| ☐ | ↻ Open a task via `?task=` deep link | Modal opens on the right task |
| ☐ | ↻ Add a comment with an `@mention` | Comment appears; mentioned member sees it in their indicator |
| ☐ | ↻ Edit, then delete, your own comment | Both work; others' comments offer delete only (admin) |
| ☐ | ↻ Upload an attachment, then download it | Signed-URL round trip works |
| ☐ | ↻ Create / complete a goal | Completion state persists |
| ☐ | ↻ Create a show, rehearsal and meeting | Each appears in its own widget |
| ☐ | ↻ Move an event's date | Calendar reflects it |
| ☐ | ↻ Set a focus pin | Shows in the Focus widget |
| ☐ | ↻ Create a reminder with a time | Appears in Reminders and on the calendar |
| ☐ | ↻ Open `/calendar` and page a month | Items land on the correct local days |
| ☐ | ↻ Open `/archive` | Archived items listed by kind |
| ☐ | ↻ Scroll the Activity feed to the end | Infinite scroll pages without duplicates |
| ☐ | ↻ Change the board palette (admin) | Widget colours update across the board |
| ☐ | ↻ Toggle "User view" as an admin | Admin-only controls disappear |
| ☐ | ↻ As a USER, confirm you cannot reorder or edit board settings | Controls absent, not just failing |

### The two hooks that deliberately stayed in `apps/web`

| | Check | Expected |
|---|---|---|
| ☐ | ↻ Open and close a detail modal | `?task=` / `?goal=` / `?event=` set and cleared; modals never stack |
| ☐ | ↻ Drag-resize a widget | No text gets selected mid-drag |

---

## P2 — Notification channels + push transport

Email must be unchanged; push is plumbed but unreachable until P13.

### Email — ↻ regression, all six triggers

| | Check | Expected |
|---|---|---|
| ☐ | ↻ `@mention` someone in a comment | They get one mail; **the author gets none** |
| ☐ | ↻ Assign a task to someone else | They get one mail; assigning yourself mails nobody |
| ☐ | ↻ Unassign them | They get an unassignment mail |
| ☐ | ↻ Add a show / rehearsal / meeting | Whole board mailed except whoever added it |
| ☐ | ↻ Move an event's start or end time | Board mailed, body shows **both** old and new time |
| ☐ | ↻ Change only an event's *location* | **No mail** — deliberate |
| ☐ | ↻ Set a reminder for ~1 min out, wait | Whole board mailed at the reminder time |
| ☐ | ↻ Re-save the same event move | **No second mail** (dedupe holds) |
| ☐ | ↻ `npm run mail:test -w apps/api` | Diagnostic mail lands in Mailpit |
| ☐ | ↻ Every mail's timestamps | Rendered in board-local time with a zone abbreviation |

### Preferences and unsubscribe — ↻ regression

| | Check | Expected |
|---|---|---|
| ☐ | ↻ Settings → Notifications shows four toggles | Mentions, Assignments, Schedule, Reminders |
| ☐ | ↻ A non-admin member can open Settings | Notification card visible; admin cards hidden |
| ☐ | ↻ Mute a category, then trigger it | No mail |
| ☐ | ↻ Click the footer unsubscribe link in a mail | Page explains first, then acts on confirm |
| ☐ | ↻ Unsubscribe, then reopen Settings | That one category now off; others untouched |
| ☐ | ★ Mute a category, then check the delivery rows | The **push** row is also `SUPPRESSED`, not just the email one |

> That last box is the consent fix review caught. Nothing writes `PUSH`
> preference rows yet, so a push row reads the email preference — otherwise a
> mute would leave a phone buzzing with no way to stop it.

### Migration safety — ★ new, verify once

| | Check | Expected |
|---|---|---|
| ☐ | ★ `SELECT count(*) FROM "NotificationDelivery"` | Pre-migration rows still present (33 at the time) |
| ☐ | ★ `npx prisma migrate status` | Up to date, no drift |
| ☐ | ★ Trigger any notification | **Two** rows written — one `EMAIL`, one `PUSH`, sharing a `dedupeKey` |
| ☐ | ★ Confirm already-sent mail doesn't resend | Dedupe history survived the table rename |

### Device registration — ★ new

| | Check | Expected |
|---|---|---|
| ☐ | ★ `POST /me/devices` with a token | `{ "registered": true }`, **not** an empty body |
| ☐ | ★ Post the same token twice | One row, `lastSeenAt` moved |
| ☐ | ★ Post the same token as a **different** user | A second row — the first user keeps theirs |
| ☐ | ★ `DELETE /me/devices/:token` for a token you don't own | The owner's row survives |
| ☐ | ★ `DELETE /me/devices/:token` for your own | `{ "unregistered": true }`, row gone |

> The third and fourth boxes are the token-hijack fix. If a token *moves*
> between users, that is the bug: knowing someone's token would be enough to
> redirect their notifications and silence their phone.

### Push delivery — ⊘ blocked on P13

| | Check | Expected |
|---|---|---|
| ☐ | ⊘ Push arrives on a device | Needs a registered device from the mobile app |
| ☐ | ⊘ Tapping a push deep-links to the right screen | Needs P8 routes + P13 client |
| ☐ | ⊘ A dead token is pruned | Needs a real `DeviceNotRegistered` from Expo |
| ☐ | ★ In dev, trigger any notification | **Nothing buzzes** — push is a no-op outside production, by design |

> Push has **no idempotency guard** — Expo's message format has no key for it.
> If the `SENT` write fails after a successful send, the phone is notified
> twice. Worth watching for once P13 lands; `collapseId` makes the repeat
> replace rather than stack, but it still buzzes.

---

## P3 — Multi-board API

Additive by design, so the headline check is that **nothing in web changed.**

| | Check | Expected |
|---|---|---|
| ☐ | ↻ Sign in as a single-board user and use the whole app | Identical to before — dashboard, calendar, archive, settings |
| ☐ | ★ `GET /boards` as that user | One entry, with `role` and `membershipId` |
| ☐ | ★ `GET /me` | `boards[0].id` equals `board.id`; `membership` matches `boards[0]` |
| ☐ | ★ Invite a second account to the board, accept, then `GET /boards` as them | One entry, `role: "USER"` |
| ☐ | ★ Create a second board for one account (or accept a second invite) | `GET /boards` lists both, oldest first |
| ☐ | ★ With two boards, reload web | Still shows the **first** board only — deliberate, closed in P15 |
| ☐ | ★ `GET /boards` as a user who is admin of one board and member of another | `role` differs per entry, not one role for the user |
| ☐ | ★ `GET /boards` as an account with **no** boards | `[]` and HTTP 200, not an error |

### The authorisation check — ★ new, do this with two real accounts

`GET /boards` has no board id, so `BoardRolesGuard` cannot run on it. The
service's `where: { userId }` is the only thing keeping bands apart.

| | Check | Expected |
|---|---|---|
| ☐ | ★ Account A and account B in **different** boards; call `GET /boards` as A | **B's board must not appear** |
| ☐ | ★ Call `GET /boards/:id` as A with **B's** board id | 404, not 403 and not the board |
| ☐ | ★ Call `GET /boards` with no bearer token | 401 |

---

## P4–P15 — not yet built

Sections get added as each phase lands. Known in advance:

- **P4** needs the one test that matters most in this project: **a member of
  board A must never see board B's calendar items or mentions.** Try it with
  two real accounts, not just unit mocks.
- **P5** is the riskiest: magic-link sign-in on a **physical** device, and the
  session surviving a force-quit.
- **P15** is the only phase that intentionally changes web behaviour.

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
| **Mobile** | a physical phone running **Expo Go** — `npm run mobile`, scan the QR code. A development build is only needed from P13. |
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
| ☐ | ★ Post the same token as a different user, then check rows | **One** row only — the newest registration claims the device |
| ☐ | ★ Hand a device over: register as A, then as B, then notify A | A's notification does **not** reach that device |
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
| ☐ | ⊘ Tapping a mention push opens that **task**, not the board root | Needs P8 routes; `taskId` is already in the payload |
| ☐ | ⊘ A push payload contains no comment excerpt or task title | Only `boardId`, `template`, and an entity id |
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

## P4 — Cross-board calendar + inbox

**Do this section with two real accounts in different boards.** Unit mocks
cannot prove a tenancy boundary; only two accounts can.

### The boundary — ★ new, highest priority in this document

| | Check | Expected |
|---|---|---|
| ☐ | ★ A and B in **different** boards. `GET /calendar?from=…&to=…` as A | **None of B's** events, tasks, goals or reminders |
| ☐ | ★ `GET /mentions` as A | **None of B's** mentions — no `taskTitle`, no `excerpt` |
| ☐ | ★ `GET /calendar?boardId=<B's board id>` as A | Empty list — **not** B's data, and not an error confirming the board exists |
| ☐ | ★ `GET /mentions?boardId=<B's board id>` as A | Empty list |
| ☐ | ★ `DELETE /mentions?boardId=<B's board id>` as A | B's mentions **still there** |
| ☐ | ★ `DELETE /mentions/<id of B's row>` as A | B's row **still there**, response still `{ deleted: true }` |
| ☐ | ★ Either route with no bearer token | 401 |

### The ex-member case — ★ new, the leak that was nearly shipped

| | Check | Expected |
|---|---|---|
| ☐ | ★ `@mention` B, confirm B sees it, then **remove B from that board** | B's `GET /mentions` no longer shows it |
| ☐ | ★ Check the database directly after removing B | B has **no** `MentionNotification` rows for that board |
| ☐ | ★ Also check `NotificationPreference` | B has no preference rows for that board |
| ☐ | ★ Re-invite B, then open their notification settings | All four categories back to default on, not their old muted values |

### Normal behaviour — ★ new

| | Check | Expected |
|---|---|---|
| ☐ | ★ One account in two boards, `GET /calendar` | Items from both, date-sorted, each with `boardId` **and** `boardName` |
| ☐ | ★ `GET /calendar?boardId=<one of them>` | Only that board's items |
| ☐ | ★ `GET /mentions` across two boards | Merged, newest first, each labelled with its board |
| ☐ | ★ `DELETE /mentions` with no filter | Every board's mentions cleared — confirm that is the blast radius you want |
| ☐ | ★ `GET /calendar` as an account with no boards | `[]`, HTTP 200 |
| ☐ | ★ `GET /calendar?from=0001-01-01T00:00:00Z&to=9999-01-01T00:00:00Z` | 400 — range capped at 370 days |
| ☐ | ★ `from` later than `to` | 400 |

### Regressions — ↻ the single-board routes must be unchanged

| | Check | Expected |
|---|---|---|
| ☐ | ↻ Web `/calendar`, page through months | Identical to before |
| ☐ | ↻ Web mentions indicator | Still polls and shows mentions |
| ☐ | ↻ Clear mentions from the web indicator | Clears **only** the current board |
| ☐ | ↻ A non-member calling `GET /boards/:id/calendar` | Still 404, not 403 |

---

## P5 — Expo skeleton + auth on a real device

**All of this is on a physical phone.** A simulator shares the laptop's network
and its keychain behaves differently, so it cannot prove either of the two
things this phase exists to prove.

Setup first, because the usual failure is here and not in the app:
`cp apps/mobile/.env.example apps/mobile/.env`, fill in your **LAN IP** (not
`localhost` — see [the app's README](../apps/mobile/README.md)) and the anon key
from `npx supabase status`. Then `npx supabase start`, `npm run dev`, and
`npm run mobile` in a third terminal.

### It runs at all — ★ new

| | Check | Expected |
|---|---|---|
| ☐ | ★ Scan the QR code with Expo Go on a phone | App loads to the sign-in screen, no red screen |
| ☐ | ★ Delete a line from `apps/mobile/.env` and reload | A readable error naming the missing variable, not a blank screen or `undefined` in a URL |
| ☐ | ★ Edit `src/screens/sign-in.tsx` | Fast Refresh updates the phone |
| ☐ | ★ Edit something in `packages/shared` or `packages/api-client` | Also refreshes — this is what the Metro `watchFolders` wiring buys |

### Signing in — ★ new

| | Check | Expected |
|---|---|---|
| ☐ | ★ Sign in with the smoke-test account | Lands on the authed screen |
| ☐ | ★ That screen shows your display name, email, and your band with its role | Proves the token reached the API and `@artist/api-client` works under Metro |
| ☐ | ★ Sign in with a wrong password | Inline error under the fields, **the email you typed is still there**, button re-enabled |
| ☐ | ★ Tap sign in twice quickly | Only one attempt; the button is disabled while pending |
| ☐ | ★ Create an account with a new email | Signs straight in (local Supabase has confirmations off) |
| ☐ | ★ Stop the API, then open the app signed in | "Could not reach the API" with a working Try again, not a crash |
| ☐ | ★ Put the phone in airplane mode and tap Try again | Same — an error state, not a hang |

### The session survives — ★ new, the point of the phase

The Supabase session is several kilobytes and SecureStore caps a value at 2048
bytes, so it is stored in chunks. These boxes are what prove the chunking:

| | Check | Expected |
|---|---|---|
| ☐ | ★ Sign in, then **force-quit** the app (swipe up, don't just background it) and reopen | Still signed in — no sign-in screen flash |
| ☐ | ★ Reopen and watch closely on a cold start | No flash of the sign-in screen before the board; the splash holds until the session is read |
| ☐ | ★ Sign out, force-quit, reopen | Sign-in screen, and no stale name or band from the previous account anywhere |
| ☐ | ★ Sign in as A, sign out, sign in as B | B's name and bands, never A's — the query cache is cleared on sign-out |
| ☐ | ★ Lock the phone, leave it over an hour, unlock and reopen the app | Still signed in and requests still work — the token refreshed despite the OS suspending timers |

### Deliberately not in this phase

| | Check | Expected |
|---|---|---|
| ☐ | ⊘ Opening an invite email on the phone | Lands in the mobile **web** browser, not the app. The API hardcodes the invite redirect to `WEB_URL/auth/callback`; accept on web, set a password, then sign in here |
| ☐ | ⊘ Any board UI — widgets, calendar, tabs | Nothing but sign-in and a one-screen proof. Starts at P6 |
| ☐ | ⊘ Dark mode looking designed | Readable in both, but the token layer is P6 |

---

## P6 — Primitives + design tokens

Two halves: the colour values moved into `packages/shared`, and the mobile token
layer built on them. The web half is covered by automated tests (86 assertions
comparing `globals.css` to the package), so **the boxes here are the ones a test
cannot tick** — whether it looks right, and whether web still looks the same.

### Web must be unchanged — ↻ regression, do this first

Nothing in `apps/web` was edited except a new test file. These boxes confirm it.

| | Check | Expected |
|---|---|---|
| ☐ | ↻ Open the dashboard in light mode | Identical to before — cream canvas, same card colours |
| ☐ | ↻ Switch to dark mode | Identical to before |
| ☐ | ↻ Settings → appearance, try all five palettes | Each looks exactly as it did; the staged preview still differs from the saved board |
| ☐ | ↻ A coloured widget with muted text, a badge and a button inside | Text still legible, borders still faint — the `[data-wc]` formula untouched |

### The phone, in both schemes — ★ new

| | Check | Expected |
|---|---|---|
| ☐ | ★ Sign-in screen in light mode | Warm cream background, not white — same canvas as web |
| ☐ | ★ Switch the phone to dark mode (Control Centre or Settings → Display) | Warm charcoal, not pure black; text stays legible |
| ☐ | ★ The band list on the authed screen | Each row a different palette slot, alternating pale and solid the way the web grid does |
| ☐ | ★ Compare one board's card colour side by side with the same board on web | The same colour. This is the whole point of the phase |
| ☐ | ★ Change the board's palette on web, reload the phone | The phone's cards follow |
| ☐ | ★ The `role` badge sitting on a coloured card | Readable on every slot, including the dark `c4` panel |
| ☐ | ★ Sign out button | Reads as destructive without shouting |

### It feels native — ★ new, judgement calls

| | Check | Expected |
|---|---|---|
| ☐ | ★ Press and hold a button | Visibly dims while held, springs back — no dead taps |
| ☐ | ★ The loading state on the authed screen | Pulsing skeletons in the shape of the cards, **not** a centred spinner |
| ☐ | ★ Card corners next to the native header | Squircles, not circular arcs (`borderCurve: "continuous"`) |
| ☐ | ★ Settings → Accessibility → Display → Larger Text, crank it up | Text grows, rows grow with it, nothing clips or overlaps |
| ☐ | ★ Tap into the email field on a short phone | The keyboard does not cover the password field or the button |
| ☐ | ★ VoiceOver / TalkBack over the sign-in screen | Fields announce their labels; the button announces its name and its busy state while signing in |

### Deliberately not in this phase

| | Check | Expected |
|---|---|---|
| ☐ | ⊘ A light/dark toggle inside the app | Follows the OS only. Web has its own toggle; the phone's setting is where people look |
| ☐ | ⊘ Bottom tabs, a board switcher, any widget | P7 |
| ☐ | ⊘ Sheets | P8, and as a native `formSheet` route rather than a component |

---

## P7 — Board hub

The first phase with real UI, so most of this is "does it say the right number".

**Do the counting checks with the demo board** (`npm run db:seed -w apps/api`)
or a board you know the contents of — a card showing a plausible-looking wrong
number is the failure mode here, and only you can spot it.

### The hub reads correctly — ★ new

| | Check | Expected |
|---|---|---|
| ☐ | ★ Open the Board tab | Cards appear in the same order as the web dashboard, hidden widgets absent |
| ☐ | ★ Count the open to-dos on web, compare the To-Do's card | Same number. Subtasks must **not** be counted — only top-level tasks |
| ☐ | ★ Give a task a due date of today | To-Do's qualifier reads "1 due today" and the urgency dot appears |
| ☐ | ★ Assign yourself a task | My Tasks goes up by one; a task assigned to someone else does not move it |
| ☐ | ★ Complete a goal on web, pull to refresh | Goals count drops, the percentage rises |
| ☐ | ★ Add a show for next week | Shows card shows its weekday; the qualifier shows the venue, or "N more" if it has no location |
| ☐ | ★ Add a show for today | Card reads "Today" with the urgency dot |
| ☐ | ★ Set the week's focus on web | Focus hero shows that text and "this week". Setting only the year's focus shows that instead |
| ☐ | ★ Type a bulleted note in the Notes widget on web | The hero shows the first line as plain text, items separated by spaces |
| ☐ | ★ A widget with nothing in it | Reads "Nothing yet", **not** "0" |
| ☐ | ★ Pull down on the hub | Everything refetches |

### Colour and layout — ★ new

| | Check | Expected |
|---|---|---|
| ☐ | ★ Compare the hub's card colours with the web dashboard | Focus coral, Goals lilac, Reminders lime, Shows ink — the same slots, in the board's palette |
| ☐ | ★ Change the board palette on web, pull to refresh | Hub cards follow |
| ☐ | ★ Hide a widget on web, pull to refresh | Its card disappears from the hub |
| ☐ | ★ Reorder widgets on web, pull to refresh | Hub order follows |
| ☐ | ★ An odd number of stat cards | The last one stays half-width — it must not stretch across the row |
| ☐ | ★ Rotate the phone, and try a large text size | Cards grow, numbers do not clip |

### Navigation — ★ new

| | Check | Expected |
|---|---|---|
| ☐ | ★ All four tabs | Board, Calendar, Inbox, You. Calendar and Inbox say what lands there; You shows your account |
| ☐ | ★ Tap the board name in the header | A sheet from the bottom, grabber visible, listing your bands with the current one ticked |
| ☐ | ★ With two bands, pick the other one | Header name changes, cards reload, palette follows |
| ☐ | ★ **Force-quit and reopen** | Still on the band you picked |
| ☐ | ★ Remove yourself from that band on web, reopen the app | Falls back to a band you are still in — never a stuck empty board |
| ☐ | ★ Tap `⋯` | A sheet listing Manage widgets, Archive and Board settings, each marked with its phase |
| ☐ | ★ Sign in as a **member**, not an admin, and tap `⋯` | Board settings is absent; Archive is present |
| ☐ | ★ Switch to Calendar, back to Board | The board tab is where you left it |
| ☐ | ★ An account in no bands at all | "No band yet", not a crash or an endless spinner |

### Deliberately not in this phase

| | Check | Expected |
|---|---|---|
| ☐ | ⊘ Tapping a card | Nothing happens yet — the spokes are P8 |
| ☐ | ⊘ The `⋯` entries | Non-interactive on purpose, rather than opening a dead end |
| ☐ | ⊘ Editing anything | P10 |
| ☐ | ⊘ Activity reading "N new since last visit" | Shows today's count and when the newest entry was; unread needs a marker that P9 defines |

---

## P8 — Spokes

Read-only, so the question is whether each widget shows **everything** the web
version does. Nothing here should change any data — if tapping something edits
it, that is a bug, not an early P10.

### Getting there and moving around — ★ new

| | Check | Expected |
|---|---|---|
| ☐ | ★ Tap a hub card | Its widget opens, titled, with the strip above it |
| ☐ | ★ Swipe left and right | Moves to the next and previous widget; the strip follows |
| ☐ | ★ Swipe to the last widget | The strip has scrolled along — the active chip must be visible, not off-screen |
| ☐ | ★ Tap a chip several along | Jumps there |
| ☐ | ★ Tap the card for the *last* widget, then swipe right | Starts on the right widget, not the first one |
| ☐ | ★ Back, then open a different card | Opens on that one |
| ☐ | ★ Hide a widget on web, refresh the hub, open a spoke | The hidden widget is not in the strip either |

### Each widget, against its web counterpart — ★ new

| | Check | Expected |
|---|---|---|
| ☐ | ★ Focus | All three horizons listed, unset ones reading "Not set" rather than being hidden |
| ☐ | ★ To-Do's | Every top-level task, with status, priority when it is not medium, assignees, subtask count, due date |
| ☐ | ★ A completed task | Struck through and dimmed, still readable |
| ☐ | ★ My Tasks | Only yours, soonest due first |
| ☐ | ★ Goals | Open ones first, then completed; period and due date on each |
| ☐ | ★ Shows / Rehearsals / Meetings | Upcoming only, soonest first, with the location where there is one |
| ☐ | ★ Reminders | Soonest first, standing notes (no date) last, overdue ones marked "due" |
| ☐ | ★ Activity | Sentences matching web's wording exactly, newest first |
| ☐ | ★ Scroll the activity feed to the bottom | More loads; it does not stop at one page |
| ☐ | ★ Notes | The note's text, paragraph by paragraph, with when it was edited |
| ☐ | ★ A widget with nothing in it | A designed empty state saying why — never a blank area or a spinner |
| ☐ | ★ Stop the API and open a spoke | "Could not load this" with a working Try again |

### Task detail — ★ new

| | Check | Expected |
|---|---|---|
| ☐ | ★ Tap a task row | Opens the task: title, status, priority, due date, description |
| ☐ | ★ A task with assignees, a checklist, subtasks, and a linked goal or event | All four sections present; the checklist shows done/total |
| ☐ | ★ Tap a subtask | Opens it; back returns to the parent |
| ☐ | ★ A task that is archived or deleted on web, then opened on the phone | "Task not found", with a way back |

### Deliberately not in this phase

| | Check | Expected |
|---|---|---|
| ☐ | ⊘ Changing a status, ticking a checklist item, reordering | All P10. Nothing on these screens writes |
| ☐ | ⊘ Comments and attachments on a task | P10 |
| ☐ | ⊘ Editing the note | P11 — it needs a different editor bridge than web's |
| ☐ | ⊘ Rich text in the note (bold, links, headings) | Rendered as plain text for now |

---

## P9 — Calendar + Inbox

The first screens that **aggregate across bands**, which makes this the phase
where a scoping mistake shows up as another band's data on your phone. Several
checks below need **two bands**: either join a second one, or create one on web
and invite yourself.

Still read-only — nothing here writes except dismissing and clearing mentions,
which delete notification rows, not comments.

### The band filter — ★ new

| | Check | Expected |
|---|---|---|
| ☐ | ★ With one band only, open Calendar and Inbox | **No filter row at all** — not a greyed-out one, not a row with a single chip |
| ☐ | ★ With two bands, open Calendar | `All · <band> · <band>`, All selected, each band with its own colour dot |
| ☐ | ★ Tap a band | The list narrows to it; the chip is filled, not just tinted |
| ☐ | ★ Filter the Calendar, then open the Inbox | The Inbox is **still on All** — the filter is per tab |
| ☐ | ★ Filter the Inbox, force-quit the app, reopen | The Inbox is still filtered to that band, and the Calendar is still on All |
| ☐ | ★ Leave a band on web (or have an admin remove you), reopen the filtered tab | Falls back to All rather than showing an empty list |
| ☐ | ★ Compare a band's dot with that band's hub | Same colour the board leads with when opened |

### Calendar — ★ new

| | Check | Expected |
|---|---|---|
| ☐ | ★ Open Calendar | This month, as a list of days, each day's items under its date |
| ☐ | ★ A day heading for today | Reads `Today · <date>` — the date is there as well as the word |
| ☐ | ★ Scroll a long day | The date heading stays stuck at the top while its items scroll |
| ☐ | ★ A show and a rehearsal on the same day | In time order, each with its clock time on the right |
| ☐ | ★ A task due that same day | Listed **first** on the day, with no invented time next to it |
| ☐ | ★ A task due on the 1st of a month, viewed from a phone set to a US timezone | On the 1st — **not** the last day of the previous month |
| ☐ | ★ Every row's meta line | Band (two bands only), kind, status for a task, location for an event |
| ☐ | ★ Step forward and back a month | Content changes; the stepper does not skip or repeat a month at a year boundary |
| ☐ | ★ Tap the month name | Returns to the current month |
| ☐ | ★ A month with nothing in it | "Nothing in <month>" — a designed state, not a blank screen |
| ☐ | ★ Tap a task row | Opens that task, in the band the row belongs to |
| ☐ | ★ Tap a show, rehearsal, meeting, reminder or goal row | Opens that band's matching widget — never a dead tap |
| ☐ | ★ With two bands on All, check items from both | Both bands' items in one list, each naming its band |
| ☐ | ★ Pull down to refresh | Reloads; a change made on web appears |
| ☐ | ★ Compare against web's calendar for the same month | Same items on the same days |

### Inbox — ★ new

| | Check | Expected |
|---|---|---|
| ☐ | ★ Have someone @mention you on web, then open the Inbox | The mention, newest first, reading "X mentioned you in …" with the excerpt |
| ☐ | ★ The Inbox tab icon | A badge with the count; `9+` past nine, and **no badge at all** at zero |
| ☐ | ★ Get mentioned while the app is open on another tab | The badge appears within 30s without reopening the app |
| ☐ | ★ Tap a mention | Opens that task in that band — and the mention **stays** in the list |
| ☐ | ★ Tap the × on a row | That row goes, the badge drops by one, the comment on web is untouched |
| ☐ | ★ "Clear all" with no filter | Confirmation names the total and says "every band" |
| ☐ | ★ "Clear all" filtered to one band | Confirmation names **that band**, and only its mentions go |
| ☐ | ★ An empty inbox | "Nothing for you", and no "Clear all" in the header |
| ☐ | ★ Stop the API, pull to refresh | "Could not load this" with a working Try again |

### Scoping — the checks that matter most

| | Check | Expected |
|---|---|---|
| ☐ | ★ On All, read every item's band label | Only bands you are a member of. Anything else is a leak |
| ☐ | ★ Have an admin remove you from a band where you were mentioned, then refresh the Inbox | Those mentions are gone — membership is re-checked per request, not trusted from before |
| ☐ | ★ Note a band's name, leave it, reopen the Calendar | Nothing from it remains, including in a month you had already loaded |

### Deliberately not in this phase

| | Check | Expected |
|---|---|---|
| ☐ | ⊘ Creating or editing an event, reminder or goal from the calendar | P10 |
| ☐ | ⊘ Replying to a mention from the Inbox | P10 — comments are write parity |
| ☐ | ⊘ A category filter (shows / tasks / goals …) like web's | Not built: the plan specifies a band filter for this phase, and two filter rows on a phone is one too many |
| ☐ | ⊘ A month *grid* | Deliberately an agenda — see the phase notes |

---

## P10–P15 — not yet built

Sections get added as each phase lands. Known in advance:

- **P13** is the other risky one, and the first phase that needs a real
  development build rather than Expo Go.
- **P15** is the only phase that intentionally changes web behaviour.

> **Lesson from P7, for every phase left:** bundling is not running.
> `expo export` proves resolution and types; `expo start` is what proves the
> toolchain, and only a phone proves the app.

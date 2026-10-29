# Feature Test Checklist

Manual verification, one section per phase of [the mobile app plan](mobile-app.md).

This is **not** the phase tracker. That records what has been *built*; this
records what a person has *clicked and seen work*. A phase can be ☑ built and
still have every box here unticked.

## How to use it

- 🔵 **Blue checks** are the priority pass on the
phone — the short list to run before building on P5–P9.
- Each line reads `check → expected`. Tick it by clicking the box in Markdown
Preview Enhanced (Cmd+K V), or by typing `x` between the brackets.
- Tick a box only after seeing the behaviour yourself. An automated test
passing is not a tick — those already run in `npm test`.
- Items marked **↻ regression** existed before the mobile work and must behave
exactly as they did. If one of these fails, the refactor broke it.
- Items marked **★ new** are behaviour that did not exist before.
- `⊘ blocked` means it cannot be tested yet, and says what it is waiting for.
- When something fails, note it next to the box rather than silently unticking.


| Platform   | Where to test                                                                                                           |
| ---------- | ----------------------------------------------------------------------------------------------------------------------- |
| **Web**    | `npm run dev` → [http://localhost:3000](http://localhost:3000)                                                          |
| **API**    | `curl` with a bearer token, or the web UI exercising it                                                                 |
| **Mobile** | a physical phone. Up to P12c **Expo Go** (`npm run mobile`, scan the QR code); from P13 the **Band Wall development build** (`npm run mobile:ios` once, then `npm run mobile`). |
| **Mail**   | Mailpit at [http://127.0.0.1:54324](http://127.0.0.1:54324)                                                             |


---

## P1 — `packages/api-client` extraction

The whole claim of this phase is **"web behaves exactly as it did."** Every box
here is a regression check, and every one of them exercises a query hook that
physically moved files. The web test suite is only 6 files, so these matter.

### Toasts — the 12 hooks that used `sonner` now route through an injected notifier

- [ ] ↻ Rename a task to something invalid / trigger any mutation error → An error toast appears, same styling and position as before
- [ ] ↻ Delete a task → Success toast reads "Task deleted"
- [ ] ↻ Archive a task, goal, event or reminder → Toast reads "Moved to the archive"
- [ ] ↻ Restore an item from `/archive` → Toast reads "Back on your dashboard"
- [ ] ↻ As admin, reset your personal layout → Toast reads "Layout reset to the board default"
- [ ] ↻ As admin, save the board default layout → Toast reads "Default layout saved for the board"
- [ ] ↻ Edit the Notes widget with the API stopped → Error toast reads "Could not save the note"
- [ ] ↻ Change board appearance with the API stopped → Error toast reads "Couldn't save appearance"
- [ ] ↻ Drag a widget with the API stopped → Error toast reads "Couldn't save layout"

> Toast *options* were the specific risk here: the `notify` interface takes only
> a message, so any `toast.error(msg, { … })` call would have had its second
> argument silently dropped. All 16 call sites were single-argument, but these
> boxes are what confirm it.

### Data layer — each moved hook, exercised once

- [ ] ↻ Sign in fresh → Board loads; `/me/bootstrap` provisions on first login
- [ ] ↻ Dashboard loads → All 10 widgets render with real data
- [ ] ↻ Check a to-do off → Ticks **immediately** (optimistic), survives a reload
- [ ] ↻ Drag to reorder to-dos (as admin) → Order holds after reload
- [ ] ↻ Change a task's status → Updates immediately; survives reload
- [ ] ↻ Open a task via `?task=` deep link → Modal opens on the right task
- [ ] ↻ Add a comment with an `@mention` → Comment appears; mentioned member sees it in their indicator
- [ ] ↻ Edit, then delete, your own comment → Both work; others' comments offer delete only (admin)
- [ ] ↻ Upload an attachment, then download it → Signed-URL round trip works
- [ ] ↻ Create / complete a goal → Completion state persists
- [ ] ↻ Create a show, rehearsal and meeting → Each appears in its own widget
- [ ] ↻ Move an event's date → Calendar reflects it
- [ ] ↻ Set a focus pin → Shows in the Focus widget
- [ ] ↻ Create a reminder with a time → Appears in Reminders and on the calendar
- [ ] ↻ Open `/calendar` and page a month → Items land on the correct local days
- [ ] ↻ Open `/archive` → Archived items listed by kind
- [ ] ↻ Scroll the Activity feed to the end → Infinite scroll pages without duplicates
- [ ] ↻ Change the board palette (admin) → Widget colours update across the board
- [ ] ↻ Toggle "User view" as an admin → Admin-only controls disappear
- [ ] ↻ As a USER, confirm you cannot reorder or edit board settings → Controls absent, not just failing

### The two hooks that deliberately stayed in `apps/web`

- [ ] ↻ Open and close a detail modal → `?task=` / `?goal=` / `?event=` set and cleared; modals never stack
- [ ] ↻ Drag-resize a widget → No text gets selected mid-drag

---

## P2 — Notification channels + push transport

Email must be unchanged; push is plumbed but unreachable until P13.

### Email — ↻ regression, all six triggers

- [ ] ↻ `@mention` someone in a comment → They get one mail; **the author gets none**
- [ ] ↻ Assign a task to someone else → They get one mail; assigning yourself mails nobody
- [ ] ↻ Unassign them → They get an unassignment mail
- [ ] ↻ Add a show / rehearsal / meeting → Whole board mailed except whoever added it
- [ ] ↻ Move an event's start or end time → Board mailed, body shows **both** old and new time
- [ ] ↻ Change only an event's *location* → **No mail** — deliberate
- [ ] ↻ Set a reminder for ~1 min out, wait → Whole board mailed at the reminder time
- [ ] ↻ Re-save the same event move → **No second mail** (dedupe holds)
- [ ] ↻ `npm run mail:test -w apps/api` → Diagnostic mail lands in Mailpit
- [ ] ↻ Every mail's timestamps → Rendered in board-local time with a zone abbreviation

### Preferences and unsubscribe — ↻ regression

- [ ] ↻ Settings → Notifications shows four toggles → Mentions, Assignments, Schedule, Reminders
- [ ] ↻ A non-admin member can open Settings → Notification card visible; admin cards hidden
- [ ] ↻ Mute a category, then trigger it → No mail
- [ ] ↻ Click the footer unsubscribe link in a mail → Page explains first, then acts on confirm
- [ ] ↻ Unsubscribe, then reopen Settings → That one category now off; others untouched
- [ ] ★ Mute a category, then check the delivery rows → The **push** row is also `SUPPRESSED`, not just the email one

> That last box is the consent fix review caught. Nothing writes `PUSH`
> preference rows yet, so a push row reads the email preference — otherwise a
> mute would leave a phone buzzing with no way to stop it.

### Migration safety — ★ new, verify once

- [ ] ★ `SELECT count(*) FROM "NotificationDelivery"` → Pre-migration rows still present (33 at the time)
- [ ] ★ `npx prisma migrate status` → Up to date, no drift
- [ ] ★ Trigger any notification → **Two** rows written — one `EMAIL`, one `PUSH`, sharing a `dedupeKey`
- [ ] ★ Confirm already-sent mail doesn't resend → Dedupe history survived the table rename

### Device registration — ★ new

- [ ] ★ `POST /me/devices` with a token → `{ "registered": true }`, **not** an empty body
- [ ] ★ Post the same token twice → One row, `lastSeenAt` moved
- [ ] ★ Post the same token as a different user, then check rows → **One** row only — the newest registration claims the device
- [ ] ★ Hand a device over: register as A, then as B, then notify A → A's notification does **not** reach that device
- [ ] ★ `DELETE /me/devices/:token` for a token you don't own → The owner's row survives
- [ ] ★ `DELETE /me/devices/:token` for your own → `{ "unregistered": true }`, row gone

> The third and fourth boxes are the token-hijack fix. If a token *moves*
> between users, that is the bug: knowing someone's token would be enough to
> redirect their notifications and silence their phone.

### Push delivery — ⊘ blocked on P13

- [ ] ⊘ Push arrives on a device → Needs a registered device from the mobile app
- [ ] ⊘ Tapping a push deep-links to the right screen → Needs P8 routes + P13 client
- [ ] ⊘ A dead token is pruned → Needs a real `DeviceNotRegistered` from Expo
- [ ] ⊘ Tapping a mention push opens that **task**, not the board root → Needs P8 routes; `taskId` is already in the payload
- [ ] ⊘ A push payload contains no comment excerpt or task title → Only `boardId`, `template`, and an entity id
- [ ] ★ In dev, trigger any notification → **Nothing buzzes** — push is a no-op outside production, by design

> Push has **no idempotency guard** — Expo's message format has no key for it.
> If the `SENT` write fails after a successful send, the phone is notified
> twice. Worth watching for once P13 lands; `collapseId` makes the repeat
> replace rather than stack, but it still buzzes.

---

## P3 — Multi-board API

Additive by design, so the headline check is that **nothing in web changed.**

- [ ] ↻ Sign in as a single-board user and use the whole app → Identical to before — dashboard, calendar, archive, settings
- [ ] ★ `GET /boards` as that user → One entry, with `role` and `membershipId`
- [ ] ★ `GET /me` → `boards[0].id` equals `board.id`; `membership` matches `boards[0]`
- [ ] ★ Invite a second account to the board, accept, then `GET /boards` as them → One entry, `role: "USER"`
- [ ] ★ Create a second board for one account (or accept a second invite) → `GET /boards` lists both, oldest first
- [ ] ★ With two boards, reload web → Still shows the **first** board only — deliberate, closed in P15
- [ ] ★ `GET /boards` as a user who is admin of one board and member of another → `role` differs per entry, not one role for the user
- [ ] ★ `GET /boards` as an account with **no** boards → `[]` and HTTP 200, not an error

### The authorisation check — ★ new, do this with two real accounts

`GET /boards` has no board id, so `BoardRolesGuard` cannot run on it. The
service's `where: { userId }` is the only thing keeping bands apart.

- [ ] ★ Account A and account B in **different** boards; call `GET /boards` as A → **B's board must not appear**
- [ ] ★ Call `GET /boards/:id` as A with **B's** board id → 404, not 403 and not the board
- [ ] ★ Call `GET /boards` with no bearer token → 401

---

## P4 — Cross-board calendar + inbox

**Do this section with two real accounts in different boards.** Unit mocks
cannot prove a tenancy boundary; only two accounts can.

### The boundary — ★ new, highest priority in this document

- [ ] ★ A and B in **different** boards. `GET /calendar?from=…&to=…` as A → **None of B's** events, tasks, goals or reminders
- [ ] ★ `GET /mentions` as A → **None of B's** mentions — no `taskTitle`, no `excerpt`
- [ ] ★ `GET /calendar?boardId=<B's board id>` as A → Empty list — **not** B's data, and not an error confirming the board exists
- [ ] ★ `GET /mentions?boardId=<B's board id>` as A → Empty list
- [ ] ★ `DELETE /mentions?boardId=<B's board id>` as A → B's mentions **still there**
- [ ] ★ `DELETE /mentions/<id of B's row>` as A → B's row **still there**, response still `{ deleted: true }`
- [ ] ★ Either route with no bearer token → 401

### The ex-member case — ★ new, the leak that was nearly shipped

- [ ] ★ `@mention` B, confirm B sees it, then **remove B from that board** → B's `GET /mentions` no longer shows it
- [ ] ★ Check the database directly after removing B → B has **no** `MentionNotification` rows for that board
- [ ] ★ Also check `NotificationPreference` → B has no preference rows for that board
- [ ] ★ Re-invite B, then open their notification settings → All four categories back to default on, not their old muted values

### Normal behaviour — ★ new

- [ ] ★ One account in two boards, `GET /calendar` → Items from both, date-sorted, each with `boardId` **and** `boardName`
- [ ] ★ `GET /calendar?boardId=<one of them>` → Only that board's items
- [ ] ★ `GET /mentions` across two boards → Merged, newest first, each labelled with its board
- [ ] ★ `DELETE /mentions` with no filter → Every board's mentions cleared — confirm that is the blast radius you want
- [ ] ★ `GET /calendar` as an account with no boards → `[]`, HTTP 200
- [ ] ★ `GET /calendar?from=0001-01-01T00:00:00Z&to=9999-01-01T00:00:00Z` → 400 — range capped at 370 days
- [ ] ★ `from` later than `to` → 400

### Regressions — ↻ the single-board routes must be unchanged

- [ ] ↻ Web `/calendar`, page through months → Identical to before
- [ ] ↻ Web mentions indicator → Still polls and shows mentions
- [ ] ↻ Clear mentions from the web indicator → Clears **only** the current board
- [ ] ↻ A non-member calling `GET /boards/:id/calendar` → Still 404, not 403

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

- [ ] ★ Scan the QR code with Expo Go on a phone → App loads to the sign-in screen, no red screen
- [ ] ★ Delete a line from `apps/mobile/.env` and reload → A readable error naming the missing variable, not a blank screen or `undefined` in a URL
- [ ] ★ Edit `src/screens/sign-in.tsx` → Fast Refresh updates the phone
- [ ] ★ Edit something in `packages/shared` or `packages/api-client` → Also refreshes — this is what the Metro `watchFolders` wiring buys

### Signing in — ★ new

- [ ] ★ Sign in with the smoke-test account → Lands on the authed screen
- [ ] ★ That screen shows your display name, email, and your band with its role → Proves the token reached the API and `@artist/api-client` works under Metro
- [ ] ★ Sign in with a wrong password → Inline error under the fields, **the email you typed is still there**, button re-enabled
- [ ] ★ Tap sign in twice quickly → Only one attempt; the button is disabled while pending
- [ ] ★ Create an account with a new email → Signs straight in (local Supabase has confirmations off)
- [ ] ★ Stop the API, then open the app signed in → "Could not reach the API" with a working Try again, not a crash
- [ ] ★ Put the phone in airplane mode and tap Try again → Same — an error state, not a hang

### The session survives — ★ new, the point of the phase

The Supabase session is several kilobytes and SecureStore caps a value at 2048
bytes, so it is stored in chunks. These boxes are what prove the chunking:

- [x] 🔵 ★ Sign in, then **force-quit** the app (swipe up, don't just background it) and reopen → Still signed in — no sign-in screen flash
- [x] 🔵 ★ Reopen and watch closely on a cold start → No flash of the sign-in screen before the board; the splash holds until the session is read
- [x] ★ Sign out, force-quit, reopen → Sign-in screen, and no stale name or band from the previous account anywhere
- [x] 🔵 ★ Sign in as A, sign out, sign in as B → B's name and bands, never A's — the query cache is cleared on sign-out
- [x] 🔵 ★ Lock the phone, leave it over an hour, unlock and reopen the app → Still signed in and requests still work — the token refreshed despite the OS suspending timers

### Deliberately not in this phase

- [ ] ⊘ Opening an invite email on the phone → Lands in the mobile **web** browser, not the app. The API hardcodes the invite redirect to `WEB_URL/auth/callback`; accept on web, set a password, then sign in here
- [ ] ⊘ Any board UI — widgets, calendar, tabs → Nothing but sign-in and a one-screen proof. Starts at P6
- [ ] ⊘ Dark mode looking designed → Readable in both, but the token layer is P6

---

## P6 — Primitives + design tokens

Two halves: the colour values moved into `packages/shared`, and the mobile token
layer built on them. The web half is covered by automated tests (86 assertions
comparing `globals.css` to the package), so **the boxes here are the ones a test
cannot tick** — whether it looks right, and whether web still looks the same.

### Web must be unchanged — ↻ regression, do this first

Nothing in `apps/web` was edited except a new test file. These boxes confirm it.

- [ ] ↻ Open the dashboard in light mode → Identical to before — cream canvas, same card colours
- [ ] ↻ Switch to dark mode → Identical to before
- [ ] ↻ Settings → appearance, try all five palettes → Each looks exactly as it did; the staged preview still differs from the saved board
- [ ] ↻ A coloured widget with muted text, a badge and a button inside → Text still legible, borders still faint — the `[data-wc]` formula untouched

### The phone, in both schemes — ★ new

- [ ] ★ Sign-in screen in light mode → Warm cream background, not white — same canvas as web
- [ ] ★ Switch the phone to dark mode (Control Centre or Settings → Display) → Warm charcoal, not pure black; text stays legible
- [ ] ★ The band list on the authed screen → Each row a different palette slot, alternating pale and solid the way the web grid does
- [ ] ★ Compare one board's card colour side by side with the same board on web → The same colour. This is the whole point of the phase
- [ ] ★ Change the board's palette on web, reload the phone → The phone's cards follow
- [ ] ★ The `role` badge sitting on a coloured card → Readable on every slot, including the dark `c4` panel
- [ ] ★ Sign out button → Reads as destructive without shouting

### It feels native — ★ new, judgement calls

- [ ] ★ Press and hold a button → Visibly dims while held, springs back — no dead taps
- [ ] ★ The loading state on the authed screen → Pulsing skeletons in the shape of the cards, **not** a centred spinner
- [ ] ★ Card corners next to the native header → Squircles, not circular arcs (`borderCurve: "continuous"`)
- [ ] ★ Settings → Accessibility → Display → Larger Text, crank it up → Text grows, rows grow with it, nothing clips or overlaps
- [ ] ★ Tap into the email field on a short phone → The keyboard does not cover the password field or the button
- [ ] ★ VoiceOver / TalkBack over the sign-in screen → Fields announce their labels; the button announces its name and its busy state while signing in

### Deliberately not in this phase

- [ ] ⊘ A light/dark toggle inside the app → Follows the OS only. Web has its own toggle; the phone's setting is where people look
- [ ] ⊘ Bottom tabs, a board switcher, any widget → P7
- [ ] ⊘ Sheets → P8, and as a native `formSheet` route rather than a component

---

## P7 — Board hub

The first phase with real UI, so most of this is "does it say the right number".

**Do the counting checks with the demo board** (`npm run db:seed -w apps/api`)
or a board you know the contents of — a card showing a plausible-looking wrong
number is the failure mode here, and only you can spot it.

### The hub reads correctly — ★ new

- [ ] ★ Open the Board tab → Cards appear in the same order as the web dashboard, hidden widgets absent
- [x] 🔵 ★ Count the open to-dos on web, compare the To-Do's card → Same number. Subtasks must **not** be counted — only top-level tasks
- [ ] ★ Give a task a due date of today → To-Do's qualifier reads "1 due today" and the urgency dot appears
- [x] 🔵 ★ Assign yourself a task → My Tasks goes up by one; a task assigned to someone else does not move it
- [x] 🔵 ★ Complete a goal on web, pull to refresh → Goals count drops, the percentage rises
- [ ] ★ Add a show for next week → Shows card shows its weekday; the qualifier shows the venue, or "N more" if it has no location
- [ ] ★ Add a show for today → Card reads "Today" with the urgency dot
- [ ] ★ Set the week's focus on web → Focus hero shows that text and "this week". Setting only the year's focus shows that instead
- [ ] ★ Type a bulleted note in the Notes widget on web → The hero shows the first line as plain text, items separated by spaces
- [ ] ★ A widget with nothing in it → Reads "Nothing yet", **not** "0"
- [ ] ★ Pull down on the hub → Everything refetches

### Colour and layout — ★ new

- [ ] ★ Compare the hub's card colours with the web dashboard → Focus coral, Goals lilac, Reminders lime, Shows ink — the same slots, in the board's palette
- [x] 🔵 ★ Change the board palette on web, pull to refresh → Hub cards follow
- [x] 🔵 ★ Hide a widget on web, pull to refresh → Its card disappears from the hub
- [x] 🔵 ★ Reorder widgets on web, pull to refresh → Hub order follows
- [ ] ★ An odd number of stat cards → The last one stays half-width — it must not stretch across the row
- [ ] ★ Rotate the phone, and try a large text size → Cards grow, numbers do not clip

### Navigation — ★ new

- [ ] ★ All four tabs → Board, Calendar, Inbox, You. Calendar and Inbox say what lands there; You shows your account
- [ ] ★ Tap the board name in the header → A sheet from the bottom, grabber visible, listing your bands with the current one ticked
- [ ] ★ With two bands, pick the other one → Header name changes, cards reload, palette follows
- [ ] ★ **Force-quit and reopen** → Still on the band you picked
- [ ] ★ Remove yourself from that band on web, reopen the app → Falls back to a band you are still in — never a stuck empty board
- [ ] ★ Tap `⋯` → A sheet listing Manage widgets, Archive and Board settings, each marked with its phase
- [ ] ★ Sign in as a **member**, not an admin, and tap `⋯` → Board settings is absent; Archive is present
- [ ] ★ Switch to Calendar, back to Board → The board tab is where you left it
- [ ] ★ An account in no bands at all → "No band yet", not a crash or an endless spinner

### Deliberately not in this phase

- [ ] ⊘ Tapping a card → Nothing happens yet — the spokes are P8
- [ ] ⊘ The `⋯` entries → Non-interactive on purpose, rather than opening a dead end
- [ ] ⊘ Editing anything → P10
- [ ] ⊘ Activity reading "N new since last visit" → Shows today's count and when the newest entry was; unread needs a marker that P9 defines

---

## P8 — Spokes

Read-only, so the question is whether each widget shows **everything** the web
version does. Nothing here should change any data — if tapping something edits
it, that is a bug, not an early P10.

### Getting there and moving around — ★ new

- [x] 🔵 ★ Tap a hub card → Its widget opens, titled, with the strip above it
- [x] 🔵 ★ Swipe left and right → Moves to the next and previous widget; the strip follows
- [ ] ★ Swipe to the last widget → The strip has scrolled along — the active chip must be visible, not off-screen
- [ ] ★ Tap a chip several along → Jumps there
- [ ] ★ Tap the card for the *last* widget, then swipe right → Starts on the right widget, not the first one
- [ ] ★ Back, then open a different card → Opens on that one
- [ ] ★ Hide a widget on web, refresh the hub, open a spoke → The hidden widget is not in the strip either

### Each widget, against its web counterpart — ★ new

- [ ] ★ Focus → All three horizons listed, unset ones reading "Not set" rather than being hidden
- [ ] ★ To-Do's → Every top-level task, with status, priority when it is not medium, assignees, subtask count, due date
- [ ] ★ A completed task → Struck through and dimmed, still readable
- [ ] ★ My Tasks → Only yours, soonest due first
- [ ] ★ Goals → Open ones first, then completed; period and due date on each
- [ ] ★ Shows / Rehearsals / Meetings → Upcoming only, soonest first, with the location where there is one
- [ ] ★ Reminders → Soonest first, standing notes (no date) last, overdue ones marked "due"
- [ ] ★ Activity → Sentences matching web's wording exactly, newest first
- [ ] ★ Scroll the activity feed to the bottom → More loads; it does not stop at one page
- [ ] ★ Notes → The note's text, paragraph by paragraph, with when it was edited
- [ ] ★ A widget with nothing in it → A designed empty state saying why — never a blank area or a spinner
- [x] 🔵 ★ Stop the API and open a spoke → "Could not load this" with a working Try again

### Task detail — ★ new

- [x] 🔵 ★ Tap a task row → Opens the task: title, status, priority, due date, description
- [ ] ★ A task with assignees, a checklist, subtasks, and a linked goal or event → All four sections present; the checklist shows done/total
- [x] 🔵 ★ Tap a subtask → Opens it; back returns to the parent
- [ ] ★ A task that is archived or deleted on web, then opened on the phone → "Task not found", with a way back

### Deliberately not in this phase

- [ ] ⊘ Changing a status, ticking a checklist item, reordering → All P10. Nothing on these screens writes
- [ ] ⊘ Comments and attachments on a task → P10
- [ ] ⊘ Editing the note → P11 — it needs a different editor bridge than web's
- [ ] ⊘ Rich text in the note (bold, links, headings) → Rendered as plain text for now

---

## P9 — Calendar + Inbox

The first screens that **aggregate across bands**, which makes this the phase
where a scoping mistake shows up as another band's data on your phone. Several
checks below need **two bands**: either join a second one, or create one on web
and invite yourself.

Still read-only — nothing here writes except dismissing and clearing mentions,
which delete notification rows, not comments.

### The band filter — ★ new

- [x] 🔵 ★ With one band only, open Calendar and Inbox → **No filter row at all** — not a greyed-out one, not a row with a single chip
- [ ] ★ With two bands, open Calendar → `All · <band> · <band>`, All selected, each band with its own colour dot
- [ ] ★ Tap a band → The list narrows to it; the chip is filled, not just tinted
- [ ] ★ Filter the Calendar, then open the Inbox → The Inbox is **still on All** — the filter is per tab
- [ ] ★ Filter the Inbox, force-quit the app, reopen → The Inbox is still filtered to that band, and the Calendar is still on All
- [ ] ★ Leave a band on web (or have an admin remove you), reopen the filtered tab → Falls back to All rather than showing an empty list
- [ ] ★ Compare a band's dot with that band's hub → Same colour the board leads with when opened

### Calendar — ★ new

- [ ] ★ Open Calendar → This month, as a list of days, each day's items under its date
- [ ] ★ A day heading for today → Reads `Today · <date>` — the date is there as well as the word
- [ ] ★ Scroll a long day → The date heading stays stuck at the top while its items scroll
- [ ] ★ A show and a rehearsal on the same day → In time order, each with its clock time on the right
- [ ] ★ A task due that same day → Listed **first** on the day, with no invented time next to it
- [x] 🔵 ★ A task due on the 1st of a month, viewed from a phone set to a US timezone → On the 1st — **not** the last day of the previous month
- [ ] ★ Every row's meta line → Band (two bands only), kind, status for a task, location for an event
- [ ] ★ Step forward and back a month → Content changes; the stepper does not skip or repeat a month at a year boundary
- [ ] ★ Tap the month name → Returns to the current month
- [ ] ★ A month with nothing in it → "Nothing in " — a designed state, not a blank screen
- [x] 🔵 ★ Tap a task row → Opens that task, in the band the row belongs to
- [ ] ★ Tap a show, rehearsal, meeting, reminder or goal row → Opens that band's matching widget — never a dead tap
- [ ] ★ With two bands on All, check items from both → Both bands' items in one list, each naming its band
- [ ] ★ Pull down to refresh → Reloads; a change made on web appears
- [x] 🔵 ★ Compare against web's calendar for the same month → Same items on the same days

### Inbox — ★ new

- [x] 🔵 ★ Have someone @mention you on web, then open the Inbox → The mention, newest first, reading "X mentioned you in …" with the excerpt
- [ ] ★ The Inbox tab icon → A badge with the count; `9+` past nine, and **no badge at all** at zero
- [x] 🔵 ★ Get mentioned while the app is open on another tab → The badge appears within 30s without reopening the app
- [ ] ★ Tap a mention → Opens that task in that band — and the mention **stays** in the list
- [x] 🔵 ★ Tap the × on a row → That row goes, the badge drops by one, the comment on web is untouched
- [ ] ★ "Clear all" with no filter → Confirmation names the total and says "every band"
- [x] 🔵 ★ "Clear all" filtered to one band → Confirmation names **that band**, and only its mentions go
- [ ] ★ An empty inbox → "Nothing for you", and no "Clear all" in the header
- [ ] ★ Stop the API, pull to refresh → "Could not load this" with a working Try again

### Scoping — the checks that matter most

- [x] 🔵 ★ On All, read every item's band label → Only bands you are a member of. Anything else is a leak
- [x] 🔵 ★ Have an admin remove you from a band where you were mentioned, then refresh the Inbox → Those mentions are gone — membership is re-checked per request, not trusted from before
- [x] 🔵 ★ Note a band's name, leave it, reopen the Calendar → Nothing from it remains, including in a month you had already loaded

### Deliberately not in this phase

- [ ] ⊘ Creating or editing an event, reminder or goal from the calendar → P10
- [ ] ⊘ Replying to a mention from the Inbox → P10 — comments are write parity
- [ ] ⊘ A category filter (shows / tasks / goals …) like web's → Not built: the plan specifies a band filter for this phase, and two filter rows on a phone is one too many
- [ ] ⊘ A month *grid* → Deliberately an agenda — see the phase notes

---

## P10 — Write parity

The phone writes for the first time: status, checklist ticks, comments with
mentions, attachments, and reorder. Every write must land on web exactly as if
it had been made there, and every control must answer for **the task's own
band** — which is not always the selected one. Use two accounts and two bands,
one where you are admin and one where you are a member.

Expo Go is still enough for this phase. Before testing attachments, make sure
`apps/mobile/.env` points `EXPO_PUBLIC_SUPABASE_URL` at your LAN address — uploads
go straight to Storage, not through the API.

### Web must be unchanged — ↻ regression, do this first

Mention parsing and the upload flow moved into the shared packages.

- [x] 🔵 ↻ On web, comment "@" + a bandmate's name → The suggestion list appears, picking one inserts it, and they get an inbox row
- [ ] ↻ On web, a comment mentioning "@sam.jones" when "sam" is also a member → Only sam.jones is notified
- [x] 🔵 ↻ On web, upload a file to a task → It appears, previews, downloads
- [ ] ↻ On web, attach a file to a comment, then delete it → It disappears from the comment **without a reload** (it used to linger — fixed here)

### Permissions follow the task's band — ★ new, the check that matters most

- [x] 🔵 ★ Select a band where you are **admin**, then open a task from the Calendar or Inbox that belongs to a band where you are a **member** → Behaves as a member: no drag, status only changeable if you are assigned
- [x] 🔵 ★ The reverse — select the member band, open a task in your admin band → Behaves as an admin
- [ ] ★ As a member, a task you are **not** assigned to → Status pill has no chevron and does nothing; a task you **are** assigned to → Chevron, opens the sheet

### Status — ★ new

- [x] 🔵 ★ Tap the status pill on a task → A sheet lists the board's statuses with their colours, the current one ticked
- [x] 🔵 ★ Pick another → The sheet closes and the task already shows the new status; web shows it after a refresh
- [ ] ★ Tap the status dot on a To-Do row → The same sheet opens; tapping the row elsewhere still opens the task
- [ ] ★ Change a subtask's status from the subtask's own screen, go back → Both the subtask and the parent's subtask list show the new status

### Checklist — ★ new

- [x] 🔵 ★ Tick an item → It ticks at once, with no flicker back while it saves; web agrees
- [ ] ★ Tick as a **member** (not admin) → Allowed — web and the API allow it too

### Comments and mentions — ★ new

- [x] 🔵 ★ Comment on a task from the phone → It appears; web shows it, with the same author and time
- [x] 🔵 ★ Type "@" and the start of a bandmate's name → Their name appears as a chip above the field; tapping it inserts "@Name " with the cursor after it
- [x] 🔵 ★ Send a comment mentioning them → They get an inbox row (and an email, per their settings) exactly as from web
- [ ] ★ The comment field near the bottom of a long task, keyboard open → The field and the Comment button stay visible above the keyboard (check **both** iOS and Android)
- [ ] ★ Edit your own comment via ⋯ → Saves, shows "edited"
- [ ] ★ Someone else's comment, as a member → No ⋯ at all. As an admin → ⋯ offers Delete only

### Attachments — ★ new

- [x] 🔵 ★ Photos → pick a picture → It uploads ("Uploading…"), then lists with its size; web shows and previews it
- [x] 🔵 ★ Camera → take a photo → First time asks for camera access; the photo uploads as a JPEG that **web can preview** (not HEIC)
- [ ] ★ Files → pick a PDF or an audio file → Uploads and lists with the right icon
- [x] 🔵 ★ Tap any attachment → Opens in the in-app browser sheet and renders; share/save works from there
- [ ] ★ Deny camera access, then tap Camera again → An alert offers Open Settings rather than failing silently
- [ ] ★ A video over 50MB → "File is larger than the 50MB limit", and nothing half-uploaded appears
- [ ] ★ Delete your own upload → Confirm prompt, then gone; someone else's upload as a member → no trash icon

### Reorder — ★ new

- [x] 🔵 ★ As an admin, open the To-Do spoke → Same order as web's To-Do widget (it used to show newest first), with "Hold a task to move it."
- [x] 🔵 ★ Hold a row, drag it, let go → It stays where dropped, with a light tap of haptics on pick-up; web's order matches after a refresh
- [x] 🔵 ★ Swipe sideways on the To-Do spoke without holding → Still pages to the next widget — the drag must not steal the swipe
- [ ] ★ Drag to the very top, and to the very bottom → Both stick
- [ ] ★ As a member → No hint and no drag; holding a row does nothing
- [ ] ★ With VoiceOver/TalkBack on, a row's actions → Move up / Move down, and they work

### Deliberately not in this phase

- [ ] ⊘ Editing a task's title, description, priority, due date or assignees; creating tasks or subtasks → Admin work, still on web
- [ ] ⊘ Attaching a file to a *comment* from the phone → Comment attachments show and can be deleted; new files go on the task
- [ ] ⊘ Creating or editing events, reminders and goals (deferred here by P9), Archive and Board settings (labelled P10 in the board menu) → Not built; where they go is an open decision

---

## P10b — Content editing

Admins can now create and edit everything on a board from the phone; members
can add subtasks. Test as an **admin**, then check the member rows with a second
account. Run the phone in a **US timezone** for the date checks; that's where
date bugs show.

### Dates — ★ new, highest priority

- [x] 🔵 ★ Look at a task due **today** on the phone → Reads "Today", and the hub's To-Do card says "1 due today". (It said "Yesterday" before this phase)
- [x] 🔵 ★ Set a task's due date to the 2nd on the phone → Web shows the 2nd, and so does the phone
- [x] 🔵 ★ Create a show at 9pm on the phone → Web shows 9pm on the same day
- [ ] ★ Set a goal's target to the 1st of next month → It sits on the 1st in the Calendar tab and on web

### Tasks — ★ new

- [x] 🔵 ★ To-Do spoke → **+** → title, priority, due, assignees → Save → It appears in the list and on web, assigned
- [x] 🔵 ★ Task detail → **Edit** → change the title → Save → The task screen already shows it; web agrees after refresh
- [ ] ★ Task detail → Subtasks → **Add** → Save → The subtask is listed under its parent
- [ ] ★ Open a subtask → No "Add" — subtasks only go one level, as on web
- [x] 🔵 ★ Edit → Archive → The form *and* the task screen close; the task is gone from To-Do and is in web's Archive
- [ ] ★ Edit → Delete → "Delete forever" → Same, and it's not in the Archive either
- [ ] ★ As a **member**, open a task → No Edit button; "Add" under Subtasks is there, and creating one works

### Events, reminders, goals, focus — ★ new

- [x] 🔵 ★ Shows spoke → **+** → It opens as a new *show*; save it → It appears in Shows, the Calendar tab **without pulling to refresh**, and web
- [ ] ★ Swipe to Rehearsals, tap **+** → It opens as a new *rehearsal* (the + follows the page)
- [ ] ★ An end time before the start → Save is disabled with "It can't end before it starts."
- [x] 🔵 ★ Tap a reminder's bell → Ticks done immediately; web agrees. Tap the row → Edit form
- [x] 🔵 ★ Tap a goal's circle → Completes it; the Goals card's count drops
- [ ] ★ Archive a goal that has linked tasks → The alert offers "Archive" *and* "Archive with N tasks"; plain Archive leaves the tasks
- [ ] ★ Focus spoke → **Edit** → set the week's focus → The hub's Focus card shows it. Clear it and save → "Not set"
- [x] 🔵 ★ As a **member**, every spoke → No **+**, no Edit, and tapping an event/reminder/goal does nothing

### Unsaved work — ★ new

- [x] 🔵 ★ Type into a form, then swipe it down (iOS) → It won't go; Cancel asks "Discard changes?"
- [ ] 🔵 ★ Same on Android with the **back button** → "Discard changes?" — *not run: no Android phone in the P10b–P12b pass; carried to P14's Android build*
- [x] 🔵 ★ Save a change → It closes without asking

### Regressions — ↻

- [ ] ↻ On web, edit a show, then open the web Calendar page → Shows the change (calendar refresh widened in the shared hooks)

---

## P10c — Board admin

The board menu's **Archive** and **Settings** now open real screens. Test as an
admin, then as a member. P10b's checks above are still unticked; run both
sections in one pass.

### Reaching them — ★ new

- [x] 🔵 ★ Board header → ⋯ → Archive → The sheet closes and the Archive opens; back returns to the board
- [x] 🔵 ★ ⋯ → Settings, as a **member** → Only "Email notifications"; no members, invites, statuses or palette

### Archive — ★ new

- [x] 🔵 ★ Archive a show on web, open the phone's Archive → It's listed as a Show, with when it was archived
- [x] 🔵 ★ Tap it (as admin) → Its form opens with **Unarchive**; unarchive → It leaves the Archive and is back in Shows
- [ ] ★ Tap an archived task → The task screen opens and says "archived"; Edit → Unarchive brings it back
- [ ] ★ Tap the "Tasks" chip, then "Goals" too → The list narrows to both; untick both → Everything again
- [ ] ★ As a **member**, tap an archived show → Nothing (a record, not a door); an archived task still opens read-only

### Settings — ★ new

- [x] 🔵 ★ Toggle an email notification off → It flips at once; web's Settings shows it off
- [x] 🔵 ★ Invite an email address → An alert says whether an email went out or they'll join on sign-in; it's listed under Pending, and Mailpit has the email
- [ ] ★ Revoke a pending invite → Confirm, then gone; web agrees
- [ ] ★ Remove a member → Confirm with web's wording; they disappear, and tasks they were on show them unassigned
- [ ] ★ Your own row in Members → No remove button
- [x] 🔵 ★ Tap a status → rename it, pick a new colour, toggle "Counts as done", Done → The To-Do rows and web show the new name and colour
- [ ] ★ Add a status → It's offered in the status sheet straight away
- [ ] ★ Delete a status that tasks still use → Refused with how many tasks use it
- [x] 🔵 ★ Pick another palette → The hub's cards recolour; web shows the new palette too, and any per-card colours set on web are kept

### Regressions — ↻

- [x] 🔵 ↻ On web, Settings → toggle a notification, send and revoke an invite, rename a status → All behave as before, with the same toasts

---

## P11 — Notes widget

The Notes widget can now be edited on the phone by an admin. Reading draws it
with real formatting; editing shows markers (`**bold**`) that turn into
formatting on save. What matters most is that **nothing written on web is ever
lost by a phone save**.

### Reading — ★ new

- [x] 🔵 ★ On web, write a note with a heading, **bold**, *italic*, a bulleted and a numbered list, and a link → The phone's Notes spoke shows all of it formatted, not as markers
- [ ] ★ Tap the link → Opens in the browser

### Editing — ⊘ deferred to P13

The phone's editor is being replaced in P13 with a Notes-style one that formats
as you type (see [the plan](mobile-app.md#p13--push-client)), so testing the
current marker editor is skipped. These checks get rewritten for the new editor
then. The ones that test *behaviour* rather than markers carry over: nothing
written on web is lost by a phone save, the concurrent-edit warning, and
members not being able to edit.

- [ ] ⊘ As admin, Notes spoke → **Edit** → change a word → Save → The spoke shows the change, formatted; web shows it after a refresh, with **all its formatting intact**
- [ ] ⊘ Select a word → **B** → Save → Bold on both
- [ ] ⊘ Caret on a line → **•** → Save → A bullet on web
- [ ] ⊘ Type `5 * 3` and save → Stays `5 * 3` on web, not italics
- [ ] ⊘ Underline a word on web (Cmd+U), then try to edit on the phone → Today: "Edit this one on web", read-only. After P13: underline is editable
- [ ] ⊘ Open Edit on the phone, change the note on **web** and save there, then save on the phone → It asks "Someone else changed this note" before replacing
- [ ] ⊘ As a **member** → No Edit button; the note reads normally

---

## P12 — Mobile layout editor

**Replaced by P12b** before it was verified: the phone no longer shares web's
arrangement, so these checks would test behaviour that is gone. They live on,
rewritten, in the P12b section below.

- [ ] ⊘ The checks P12 shipped with (reorder moves web too, reset to the band's default, "Make this the band's default" on the phone) → Replaced by P12b

---

## P12b — Phone arrangement

The phone now has its **own** arrangement, edited on the hub itself: hold a
card (or ⋯ → Edit widgets) to start, then move, resize (up to 2×2) and hide
cards. Until you save one, the phone **follows your web dashboard**. Restart
the API (`npm run dev`) and Expo (`npm run mobile`) first.

### Following web — ★ new

- [x] 🔵 ★ Without arranging the phone, drag Shows to the top-left on web, wait a second, then pull to refresh the phone's hub (check the header says the right band) → Shows is the **first** card
- [ ] ★ Swipe through the spokes → Same order as the hub
- [ ] ★ Hide a widget on web → Also gone from the phone's hub (it's still following)

### Editing on the hub — ★ new

- [x] 🔵 ★ Hold a card → Edit mode: every card gets an eye (top right) and a corner handle; the header says Cancel and Done. ⋯ → Edit widgets does the same
- [x] 🔵 ★ Hold a card and drag it over another → The others slide out of the way; let go and it settles in its new place. Done → It stays there. **Web is unchanged** after a refresh
- [x] 🔵 ★ Drag a card's corner right and down → A dashed outline shows the new size; let go → The card is 2×2, and the cards around it re-flow with no overlap
- [x] 🔵 ★ A card two rows tall → Lists a few items under its number (Shows lists the next shows, To-Do the top tasks)
- [ ] ★ Drag a card towards the bottom (or top) edge of the screen → The hub scrolls with it
- [ ] ★ Hold the corner handle still for a moment, then drag → It resizes; it does not start moving the card
- [x] 🔵 ★ Tap a card's eye → It disappears and shows under "Hidden" at the top; tap it there → It's back where it was
- [ ] ★ Hide all but one card → The last card's eye is greyed out
- [ ] ★ Out of edit mode, a one-column card with nothing beside it → Drawn across the full width (no half-empty rows)
- [ ] ★ Change something, then Cancel → "Discard changes?"
- [ ] ★ After a phone save, rearrange on web → The phone doesn't move
- [x] 🔵 ★ Edit mode → "Follow my web dashboard" (only shown once the phone has its own arrangement) → Confirm → The hub goes back to web's order; web is unchanged
- [ ] ★ Arrange as one member → A second member's phone and web are unchanged
- [ ] ★ With VoiceOver on, edit mode → Each card offers Move earlier/later, Make wider/taller, Hide

### Regressions — ↻

- [x] 🔵 ↻ On web, drag and resize widgets, then Reset layout → Same as before; and a phone that has its own arrangement keeps it
- [ ] ↻ Tap a card outside edit mode → Its spoke opens, as before

### Continuous hold-to-drag — 2026-10-23

Trello: [Keep dragging the widget held to enter edit mode](https://trello.com/c/ZierGtDw).
Follow-up: [Entering widget edit mode shifts the grid and reorders the held card](https://trello.com/c/4LQF3vOr).

- [x] 🔵 Hold a widget outside edit mode, keep the same finger down, then move → That widget follows immediately; no second hold is needed (user confirmed on simulator)
- [x] 🔵 Enter edit mode by holding a widget in a lower row without moving → Other widgets stay in place, and releasing does not reorder anything (user confirmed on simulator)
- [ ] 🔵 Drag it over another widget, release, and tap Done → The new order survives reopening the board
- [x] Hold without moving, then release → Edit mode stays open and the widget stays in its original position (user confirmed on simulator)
- [ ] Start on a lone one-column widget drawn across the row → It stays under the finger as edit controls appear, then settles to its edit size on release
- [ ] While editing, drag near the screen edges → Auto-scroll still follows; drag the corner handle → It resizes
- [ ] Outside edit mode, tap a widget → Its spoke opens; swipe promptly → The dashboard scrolls without entering edit mode

---



## P12c — Polish

Driven by tickets on the Trello board rather than a list here. Check each fix
against its ticket, and move the ticket along on the board when it holds.

---



## P13 — Push client

**From P13 on, each phase's checks live on a Trello card**, as a checklist that
ticks from the phone: [P13 — Push client testing](https://trello.com/c/dbXgr4F9/20-p13-push-client-testing)
on the Band Board board. Anything that fails gets its own card. This file keeps
P1–P12c as the record and points at the card for each later phase.

Setup for P13 (once): accept Apple's latest Program License Agreement; upload a
push key with `cd apps/mobile && npx eas-cli@latest credentials -p ios`;
plug the iPhone in with Developer Mode on and run `npm run mobile:ios`; set
`PUSH_IN_DEV=true` in `apps/api/.env`. Day to day: `npm run mobile` (or
`npm run mobile:tunnel`), then open Band Wall.

---



## P17 — Redesign

Checks live on the Trello card [P17 — Redesign testing (widget page + calendar)](https://trello.com/c/99Ht7oXP), one checklist per step: the widget page and calendar first, then the widget screens. Later steps (task, event and goal pages; Inbox and You; sheets and forms; the rest; light and dark) add their own checklist to the same card.

Run it from the `feat/mobile-redesign` branch with `npm run mobile` (or `npm run mobile:tunnel`), then open Band Wall. No rebuild is needed.

---



## Band finances

Checks live on the Trello card [Band finances testing](https://trello.com/c/ML7yp6EI), one checklist for web and one for the phone. Run `npx prisma migrate deploy` from `apps/api` first (new migration `20261022200000_band_finances`), then `npm run db:seed -w apps/api` for a demo ledger.

---

## P14, P15, P16 and P18

Each gets a Trello testing card when it lands, linked from a short section here.

- **P14** (store builds) and **P18** (join links) are not built yet.
- **P15** (web band picker) is built and awaiting verification. It's the only phase that intentionally changes web behaviour: anyone in more than one band gets a band picker in the header.
- **P16** (Notes-style editor) was dropped on 2026-10-20 in favour of titled notes, so P11's deferred editing checks belong to the notes widget as it is now.

> **Lesson from P7, for every phase left:** bundling is not running.
> `expo export` proves resolution and types; `expo start` is what proves the
> toolchain, and only a phone proves the app.


## Finance member history, colors, and filters

Implemented on mobile and web; interaction checks are pending on these Testing tickets:

- [View a member’s finance expenses and payouts](https://trello.com/c/pxlHLAhg): open an owed member; confirm their all-time personal expenses and payments, dates, notes, and empty states. Changing the ledger period must not shorten member history.
- [Color finance profits green and losses red](https://trello.com/c/ix836zac): check positive, negative, and zero totals in light and dark mode; signs and labels should remain readable. Check the mobile hub's net value too.
- [Filter and sort finance entries](https://trello.com/c/onUwJaAu): combine type, member, category, status, and period; try all four sort orders, no matches, and Reset filters. On web, exported CSV should match the visible ledger order.

TypeScript checks cover both apps. No database migration is needed for these three changes.


## Links on items

Checks live on [Attach links to items](https://trello.com/c/jhggFZOC). Tasks, events (shows, rehearsals, meetings), goals, and reminders now have a Links section on web and mobile. Tap **Add a link**, optionally name it, paste a web address, and save. Existing items only; save a new item first.

The local migration `20261025183000_item_links` is applied. Other environments need `npx prisma migrate deploy` from `apps/api`; regenerate the Prisma client after updating the schema. No mobile rebuild is needed.

Automated checks: 24 API link/validation cases, six web interaction tests (including failed-save retry), full API/client/web/mobile suites, TypeScript and targeted lint checks pass. The database matches the schema.

Verified 2026-10-26: the October 25 feature-test run (API, database, simulator) and a re-run on October 26 (live API, database and the web form in a browser) passed, and the user confirmed the three phone checks. All checks are ticked on the card.


## Show statuses

Checks live on [Show statuses testing](https://trello.com/c/YyHbu8qz), with the plan in [plans/show-statuses.md](plans/show-statuses.md). Run `npx prisma migrate deploy` from `apps/api` first (new migration `20261027234513_show_statuses`, which backfills existing shows as Confirmed), then `npm run db:seed -w apps/api` for demo shows in every status plus a custom "Advanced" one.

Verified 2026-10-28: Elton checked every item on web and phone, and the card's checklists are ticked.


## Band name on detail views

Every task, event, goal and reminder detail view shows which band the item belongs to, on web and phone (`b67b946`). There's no Trello card for it.

Verified 2026-10-28 in a feature test with one account in two bands. Elton checked off every item.


## Sign-in behind AuthClient

Web and phone now sign in through a shared `AuthClient` instead of calling Supabase directly (branch `feat/auth-client`). Nothing should look or behave differently, so every check is a **↻ regression**. There's no Trello card for it.

- [ ] ↻ Web: sign in with email and password → lands on the dashboard
- [ ] ↻ Web: wrong password → "That email and password don't match" toast, form keeps the email
- [ ] ↻ Web: create an account → signed in on the "You're not on any band's wall yet" screen, with Create a band
- [ ] ↻ Web: sign out from the header, and from the "no band" screen → back to `/login`
- [ ] ↻ Web: invite someone, open the Mailpit link → `/auth/callback` asks for a password, saving it lands on the dashboard
- [ ] ↻ Web: sign out, then sign in as a different user in the same tab → no data from the first user shows
- [ ] ↻ Web: stop Supabase (`supabase stop`) and sign in → "Can't reach Band Wall" message, button usable again
- [ ] 🔵 ↻ Phone: sign in, close the app fully, reopen → still signed in, no sign-in flash
- [ ] 🔵 ↻ Phone: leave the app in the background for over an hour, reopen → requests still work (token refreshed)
- [ ] ↻ Phone: "Join with an invite code" with the code from Mailpit plus a password → signed in, and that password works on web
- [ ] ↻ Phone: sign out from the You tab and from the tab bar → back to sign-in
- [ ] ↻ Both: revoke a session (delete the user's session in Supabase Studio) and make a request → one "session expired" message, back to sign-in


## Better Auth

Sign-in moved from Supabase Auth to Better Auth inside the API (branch `feat/better-auth`, plan [plans/better-auth.md](plans/better-auth.md), cards AUTH-001 to AUTH-006). Accounts from the Supabase days are imported with their passwords by migration `import_supabase_users`: sign in as usual. Run `npx prisma migrate deploy` from `apps/api` and add `BETTER_AUTH_SECRET` to `apps/api/.env` first.

- [ ] 🔵 Web: create an account → signed in on the create-or-join screen; Create a band works
- [ ] 🔵 Web: sign out, sign in with the same password → back on the band
- [ ] Web: wrong password → "That email and password don't match", email kept
- [ ] 🔵 Web: invite a new email → Mailpit shows "<you> invited you to <band> on Band Wall" with a link and a 6-digit code
- [ ] 🔵 Web: open the invite link in a private window → "You're in", set a password → on the band; that password then signs in
- [ ] Web: open the same invite link again → "Link expired" with "That code doesn't work…"
- [ ] 🔵 Phone: "Join with your code" with the email's code and a password → on the band
- [ ] Phone: a wrong code → "That code doesn't work…" under the field
- [ ] 🔵 Phone: sign in, close the app fully, reopen → still signed in
- [ ] Phone: sign out from You → sign-in screen
- [ ] Both: sign out on one device doesn't sign out the other; deleting the session row signs that device out on its next request with "session expired"
- [ ] Sign in with an account and password from before the switch → its bands are there
- [ ] Invite an email that already has an account → "Invite saved", no email; they see the band on next sign-in


## Subscriptions

Per-band subscriptions through RevenueCat; the rules are in [billing.md](billing.md). Checks live on [Band Wall subscriptions testing](https://trello.com/c/w9acE6hT). Feature test 2026-10-29 (report linked on the card): 16 checks, none failed; four need a real store or a real webhook. Run `npx prisma migrate deploy` from `apps/api` first (new migration `20261029212835_billing`). The phone needs a **new development build** (`react-native-purchases` is native). For the purchase checks, use the RevenueCat Test Store key and a webhook tunnel as described in [Testing locally with the Test Store](billing.md#testing-locally-with-the-test-store).

Automated checks: webhook mapping, idempotency and auth, the 402 guard and the cross-board narrowing are unit tested in `apps/api/src/billing` and `user-boards.guard.spec.ts`.

### Billing off — ↻ regression, do this first
- [ ] 🔵 With `BILLING_ENFORCED` unset, open every band on web and phone → everything works as before; no paywall
- [ ] Settings on web → a subscription card reading "Not subscribed."; on the phone a subscription row (when a RevenueCat key is set)

### The gate — ★ new, `BILLING_ENFORCED=true`
- [ ] 🔵 Web, unpaid band → the subscription paywall in place of every page (dashboard, calendar, finances, settings); the band switcher marks it "Needs a subscription"
- [ ] 🔵 Phone, unpaid band → the subscription screen in place of the hub; "Switch band" reaches a paid band
- [ ] A paid band opens normally for a member who never paid
- [ ] The phone's Calendar and Inbox tabs show only paid bands' items
- [ ] An admin can still invite to an unpaid band; the invitee joins and lands on the paywall
- [ ] A member (not admin) of an unpaid band sees "Ask one of the band's admins to subscribe", no buy button
- [ ] `npm run billing:grant -w apps/api -- <boardId>` → that band opens after a refresh

### Buying — ★ new, Test Store + webhook tunnel
- [ ] 🔵 Web: Subscribe → RevenueCat paywall; closing it does nothing and shows no error
- [ ] 🔵 Web: buy a plan → "Confirming your purchase…", then the wall opens
- [ ] 🔵 Phone: subscription screen lists Monthly and Yearly with prices; buying one opens the wall
- [ ] Phone: backing out of the store sheet shows no error
- [ ] Phone: Restore purchases on a band that already paid → stays Pro; on a store account with nothing → "Nothing to restore"
- [ ] Phone: Manage subscription opens the Customer Center
- [ ] Every other member of the band gets in without paying

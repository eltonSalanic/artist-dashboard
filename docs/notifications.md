# Email Notifications

> **Status:** being built. The delivery pipeline ships; individual triggers land
> one at a time — the Implemented column below is the authority on what is live.

Transactional email is sent through **[Resend](https://resend.com)**. Board
invites are the exception: they are still sent by Supabase GoTrue, which owns
the magic-link token (see [Invites](#invites-are-not-ours) below).

## Design rules

These are the rules the trigger table follows. New triggers should too.

1. **Email is for things you'd want to know while *not* looking at the app.**
   Everything else belongs in the activity feed. Of the eight `ActivityType`
   values, only assignment and mentions clear that bar.
2. **Never email the actor for their own action.** Every trigger excludes the
   user who caused it, even when they're a legitimate recipient by role.
3. **Every send is deduplicated.** A row in `EmailDelivery` keyed by a
   deterministic `dedupeKey` is written in the same transaction as **the
   mutation that triggers it** — never the send, which happens after that
   commits. The unique index makes a replayed cron or a concurrent second API
   instance a no-op. It cannot cover a crash *between* a successful send and
   recording it, so the same key is also passed to Resend as its
   `Idempotency-Key`, which can.
4. **Every email is suppressible.** Per-user, per-board preferences plus a
   signed one-click unsubscribe link in every message.
5. **Recipients are resolved at send time**, not at schedule time — someone
   removed from the board between scheduling and sending gets nothing.

## Trigger reference

| # | Trigger | Recipients | Timing | Source | Implemented |
|---|---|---|---|---|---|
| 1 | **Mentioned in a comment** | Users named in `Comment.mentions`, minus the author | Immediate | `CommentsService.create` | ☑ |
| 2 | **Assigned to a task** | The newly added assignee(s), minus the actor | Immediate | `TasksService.create`, `TasksService.setAssignees` (`added`) | ☐ |
| 3 | **Unassigned from a task** | The removed assignee(s), minus the actor | Immediate | `TasksService.setAssignees` (`removed`) | ☐ |
| 4 | **Show, rehearsal, or meeting added** | All board members, minus the actor | Immediate | `EventsService.create` | ☐ |
| 5 | **Show, rehearsal, or meeting moved** | All board members, minus the actor | Immediate | `EventsService.update` (diff on `startsAt` / `endsAt`) | ☐ |
| 6 | **Day-of show summary** | All board members | 08:00 board-local on the day of the show | `ShowSummaryJob` (cron) | ☐ |
| 7 | **Reminder due** | All board members | At `Reminder.remindAt` | `ReminderJob` (cron) | ☐ |
| 8 | **Tasks due tomorrow** | Assignees of each due task | 18:00 board-local, one digest per user | `DueTomorrowJob` (cron) | ☐ |

### Per-trigger detail

**1 — Mentioned in a comment.** Keyed `mention:{commentId}:{userId}` — one
comment mentioning one person is one email, however many times the write is
replayed. Fires on comment *creation* only. Editing a
comment to add a new `@name` does **not** notify: `notifyMentions` is called
from `create` and not from `update`, and the email follows the same rule so the
in-app `MentionNotification` list and the inbox never disagree. The email body
reuses the snapshot already stored on `MentionNotification` (`actorName`,
`taskTitle`, `excerpt`), so it renders correctly even after the comment is
edited or deleted.

**2 / 3 — Assignment changes.** `setAssignees` replaces the whole set and diffs
it, producing `added` and `removed` arrays; those arrays are the recipient
lists. A user who appears in neither array (unchanged membership on the task)
is not emailed. Assigning yourself never emails you.

**4 — Event created.** Covers all three `EventType` values. The email leads
with type, title, start time, and location.

**5 — Event moved.** Only a change to `startsAt` or `endsAt` notifies. Renames,
description edits, and — deliberately — **location changes** do not, because a
schedule change is the thing people plan their day around. Revisit if venue
changes turn out to matter as much in practice. The email states both the old
and the new time.

**6 — Day-of show summary.** `EventType.SHOW` only; rehearsals and meetings get
the creation and move emails but no day-of digest. Contains the set time,
location, and every task linked to that event with its status, so the "who's
bringing the cables" question is answered in the email.

**7 — Reminder due.** Reminders have no owner in the schema, so they go to the
whole board. Suppressed when the reminder is `done` or archived at send time.
Reminders with a null `remindAt` never notify — they're notes, not alarms.

**8 — Tasks due tomorrow.** One digest per user listing all of their tasks due
the next board-local day, not one email per task. Skips tasks whose status has
`isDone = true` and tasks that are archived. A task with no assignees emails
nobody — it is deliberately not broadcast to the board.

## Suppression rules

An email is not sent when any of these hold at send time:

- The recipient caused the event (all triggers).
- The recipient has turned that category off in their preferences.
- The recipient is no longer a member of the board.
- A matching `dedupeKey` already exists in `EmailDelivery`.
- The recipient's address is marked undeliverable by a Resend bounce or
  complaint webhook.
- The underlying row was archived, completed, or deleted between scheduling and
  sending (triggers 6–8).

## Preferences

Stored per user **per board** — someone in two bands can be loud in one and
quiet in the other. Categories are coarser than triggers on purpose:

| Category | Covers triggers |
|---|---|
| `mentions` | 1 |
| `assignments` | 2, 3 |
| `schedule` | 4, 5, 6 |
| `reminders` | 7 |
| `dueTasks` | 8 |

All default to on. Unsubscribe links carry a signed token identifying
`(userId, boardId, category)` so one click turns off exactly one category
without a login.

## Timezones

Triggers 6 and 8 fire at a wall-clock hour, which requires a timezone.
`Board.timezone` (IANA name) is the source of truth — a band shares a
rehearsal room and a local time — and defaults to `America/Los_Angeles` at the
schema level, so every existing board already has a usable value.
Timestamps in email bodies are rendered in board-local time with the zone
abbreviation shown, so nobody has to do the maths.

## Delivery, retries, and failure

- Sends happen **after** the database transaction commits, never inside it. A
  mail outage must not roll back a task assignment.
- A failed send is recorded on the `EmailDelivery` row with its error and
  retried with backoff. Retries are bounded; a permanently failing address is
  suppressed rather than retried forever.
- Bounce and complaint webhooks from Resend mark an address undeliverable.
  Nothing is sent to a suppressed address until it is manually cleared.

## Local development

Mail is routed to **Mailpit**, the local Supabase stack's mail catcher, instead
of Resend whenever `NODE_ENV !== 'production'`. The web UI is at
`127.0.0.1:54324`. Mailpit's SMTP port is published via `smtp_port = 54325`
under `[inbucket]` in [supabase/config.toml](../supabase/config.toml); it ships
commented out upstream, so a fresh clone needs `npx supabase stop && npx
supabase start` after checking out that change.

`npm run mail:test -w apps/api` queues a diagnostic email — the fastest way to
check the pipeline, or how a real client renders the layout after editing it.

The demo seed (`npm run db:seed -w apps/api`) must never send email: its
synthetic bandmates use `@demo.band` addresses that cannot receive mail, and
seeding writes no notification rows.

## Invites are not ours

`SupabaseAdminService.inviteByEmail` calls GoTrue's `inviteUserByEmail`, and
**GoTrue** renders and sends that message — not Resend. The template lives in
Supabase, and the magic-link token is minted by Auth. Moving invites to Resend
would mean switching to `generateLink` and sending the mail ourselves, which
puts the auth flow's blast radius on the line for a cosmetic gain. Left alone
deliberately.

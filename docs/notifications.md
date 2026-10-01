# Email Notifications

> **Status:** shipped. All six triggers below are live, as are preferences,
> unsubscribe, and bounce/complaint suppression. Two further triggers were
> specified and deliberately dropped (see [Considered and
> dropped](#considered-and-dropped)).
>
> Still outstanding: no editor for `Board.timezone`, so every board renders
> email timestamps in the schema default (`America/Los_Angeles`). Going to
> production also needs a Resend domain with SPF/DKIM, and an API host that
> **stays running** — the dispatcher and the reminder job are in-process
> `@Interval`s and will never fire on a serverless host that sleeps.

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
| 2 | **Assigned to a task** | The newly added assignee(s), minus the actor | Immediate | `TasksService.create`, `TasksService.setAssignees` (`added`) | ☑ |
| 3 | **Unassigned from a task** | The removed assignee(s), minus the actor | Immediate | `TasksService.setAssignees` (`removed`) | ☑ |
| 4 | **Show, rehearsal, or meeting added** | All board members, minus the actor | Immediate | `EventsService.create` | ☑ |
| 5 | **Show, rehearsal, or meeting moved** | All board members, minus the actor | Immediate | `EventsService.update` (diff on `startsAt` / `endsAt`) | ☑ |
| 6 | **Reminder due** | All board members | At `Reminder.remindAt` | `ReminderDueJob` (cron) | ☑ |

Two further triggers were specified and then deliberately dropped — see
[Considered and dropped](#considered-and-dropped).

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

Both key on `TaskAssignee.createdAt` — `assign:{taskId}:{userId}:{createdAtMs}`
and `unassign:{...}` on the assignment that just ended. That column exists for
exactly this: the composite primary key makes a duplicate row impossible, so
two concurrent writes collapse to one email, while a genuine
unassign-then-reassign is a new row and correctly notifies again. Keying on
`Date.now()` instead would have let the concurrent case through.

Assignment at creation time counts too — `TasksService.create` queues for
anyone named in `assigneeIds`, minus the creator.

**4 — Event created.** Covers all three `EventType` values. The email leads
with type, title, start time, and location.

**5 — Event moved.** Only a change to `startsAt` or `endsAt` notifies. Renames,
description edits, and — deliberately — **location changes** do not: a venue
change is better communicated in the group chat, while a schedule change is
what people plan their day around. The email states both the old and the new
time. Keyed `event-moved:{eventId}:{newStartsAtMs}:{userId}`, so moving it
again notifies but replaying the same move does not.

**6 — Reminder due.** Reminders have no owner in the schema, so they go to the
whole board. Reminders with a null `remindAt` never notify — they're notes, not
alarms.

The reminder's own state is read **at queue time**, not at send time: `done` and
`archivedAt` are part of the job's `where`, and nothing re-reads the row before
the mail goes out. Completing a reminder in the seconds between the two loops
still sends — and after a failed send backs off, that gap can stretch to hours.
The dispatcher is deliberately template-agnostic (one drain loop serves all six
triggers, knowing nothing about reminders), so closing this would mean giving
templates a freshness hook. Not worth the concept for one trigger and a window
this small; revisit if a second clock-driven trigger ever needs it.

This is the only trigger that fires on a clock rather than on a mutation, and
it fires at an *absolute* instant (`remindAt`), not a wall-clock hour — so
unlike the two dropped triggers it needs no board-local hour selection and no
DST reasoning. `Board.timezone` still decides how the time is *rendered*.

## Considered and dropped

**Day-of show summary** (08:00 board-local, `SHOW` events, with the linked
tasks) — dropped. The band checks the board on a show day anyway, and they
already know when their own shows are. The creation and move emails cover the
part that's actually news.

**Tasks due tomorrow** (18:00 board-local, one digest per assignee) — dropped
for the MVP. Not necessary; the To-Dos widget already shows what's due.

Both are still described in the plan if they're ever wanted. The `DUE_TASKS`
value stays in the `EmailCategory` enum rather than being migrated away: it
costs nothing, and dropping an enum value is a migration that would have to be
reversed to bring the digest back.

## Suppression rules

An email is not sent when any of these hold at send time:

- The recipient caused the event (all triggers).
- The recipient has turned that category off in their preferences.
- The recipient is no longer a member of the board.
- A matching `dedupeKey` already exists in `EmailDelivery`.
- The recipient's address is marked undeliverable by a Resend bounce or
  complaint webhook.

Note what is **not** on that list: the state of the row the email is *about*.
Only the recipient is re-checked at send time. See trigger 6 above.

## Preferences

Stored per user **per board** — someone in two bands can be loud in one and
quiet in the other. Categories are coarser than triggers on purpose:

| Category | Covers triggers |
|---|---|
| `mentions` | 1 |
| `assignments` | 2, 3 |
| `schedule` | 4, 5 |
| `reminders` | 6 |

All default to on. Unsubscribe links carry a signed token identifying
`(userId, boardId, category)` so one click turns off exactly one category
without a login.

## Timezones

No trigger fires at a wall-clock hour any more, so nothing *selects* on
timezone — but every timestamp in a body still has to be rendered in one.
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
  `POST /webhooks/resend` verifies the Svix signature over the **raw** request
  body — hence `rawBody: true` in `main.ts`, since body-parser's
  parse-then-restringify is not byte-identical — and writes `EmailSuppression`.
  Only a *permanent* bounce suppresses; a transient one (a full mailbox, a
  temporary outage) is ignored, and complaints always suppress. With no
  `RESEND_WEBHOOK_SECRET` set the endpoint rejects everything rather than
  trusting unsigned events. Nothing is sent to a suppressed address until the
  row is cleared by hand.

## Unsubscribe

Two links, because they are two different things:

| | Goes to | Who follows it |
|---|---|---|
| `List-Unsubscribe` header | `API_URL/unsubscribe?token=` | Gmail's one-click button, which **POSTs** with no session |
| Footer link | `WEB_URL/unsubscribe?token=` | A person, who gets a page explaining what will happen |

The header cannot point at the web app: it is a static client bundle and cannot
answer a POST. The endpoint is POST-only and the page asks before acting —
link scanners and mail-client prefetchers follow every URL in a message, and a
GET that unsubscribed would let a security appliance turn someone's email off
for them.

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

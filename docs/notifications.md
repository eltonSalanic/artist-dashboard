# Notifications

> **Status:** email and push shipped. All six triggers below are live on both
> channels, as are preferences, unsubscribe, and bounce/complaint suppression.
> Push reaches any phone that signed in to the Band Wall development build and
> allowed notifications (P13 in [docs/mobile-app.md](mobile-app.md)). Two
> further triggers were specified and deliberately dropped (see [Considered and
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

## Channels

One notification, two ways out. `NotificationDelivery` carries a
`NotificationChannel` (`EMAIL` | `PUSH`), and `queue()` writes **one row per
channel** for every recipient.

**Why one outbox and not two.** The claim mechanism (a conditional `updateMany`
that checks `count === 1`), the backoff ladder and the drain loop are
concurrency-sensitive, and a second copy would be a second place to get
multi-instance safety wrong. What actually differs per channel is the transport
and what counts as undeliverable — and both of those were already seams.

**Both channels render the same template**, once, in the dispatcher. Email uses
`subject`/`html`/`text`; push uses the optional `push: { title, body }` a
template may provide, falling back to the subject line and the first non-empty
line of the plaintext body. A template cannot describe the same event
differently on two channels because it is only asked once.

**`dedupeKey` is unique *with* the channel**, not alone. One trigger
legitimately produces an email row and a push row for the same person, and a
single-column unique index would have deduped one of them away.

| | Email | Push |
|---|---|---|
| Transport | Resend (prod) / Mailpit (dev) / noop (test) | Expo (prod) / noop everywhere else |
| Undeliverable means | address in `EmailSuppression` (bounce/complaint) | recipient has no row in `DeviceToken` |
| Dead recipient handling | address suppressed until cleared by hand | token deleted on `DeviceNotRegistered` |
| Idempotency | `dedupeKey` as Resend's `Idempotency-Key` | **none** — see below |

Push is a **no-op outside `NODE_ENV=production`**, for the same reason mail goes
to Mailpit: a dev run must not be able to buzz a real phone, and the destructive
demo seed has to stay safe to re-run. `PUSH_IN_DEV=true` in `apps/api/.env` is
the one way round that, for testing the phone app against a local API: Expo only
delivers to tokens a signed-in phone registered, and the seeded bandmates have
none. It is never honoured under `NODE_ENV=test`.

### Device tokens

`DeviceToken` is one row per *install*, not per user — the same person on a
phone and a tablet is two rows and both should ring. Deliberately **not**
board-scoped: a token belongs to a device, which belongs to a person who may be
in several bands. Which boards may notify them is a preference question.

`POST /me/devices` upserts on `(userId, token)`. Re-registering on every launch
must touch one row rather than accumulate them, or a notification would arrive
once per launch the user ever made.

The token is unique **per user, not globally**, and `register` never writes
`userId` on update — so it can never rewrite another account's row in place.
It does, in the same transaction, **delete any other account's row for that
token**: the newest registration claims the device.

That ordering is a judgement call, because nothing here can tell a legitimate
handover from someone who has merely learned a token:

- Leave other rows alone, and a phone passed from one bandmate to another keeps
  putting the *previous* owner's notification titles and bodies on the new
  owner's lock screen until they sign out of a device they no longer hold.
- Remove them, and anyone who knows a token can take it, stopping its owner's
  notifications.

The first is a live content leak on an ordinary action. The second needs an
attacker who already holds a token that exists only on that device and in this
API — at which point they very likely have the session too. So the leak is the
one worth closing. `DELETE /me/devices/:token` stays scoped to the caller's own
tokens.

`lastSeenAt` is written on every registration but **nothing reads it** — there
is no prune job. Dead tokens are removed reactively, when Expo answers a send
with `DeviceNotRegistered`, which covers the case that matters: an app deleted
or its permissions revoked. A sweep over `lastSeenAt` would only catch installs
that stopped being opened without being uninstalled, and those still accept
pushes.

A push carries `boardId`, `template`, and the entity id (`taskId` / `eventId`)
from the delivery's payload, so a tap opens the thing the notification is about
rather than the board root. The ids are **whitelisted, not spread** — the
payload is a template's render snapshot and also holds comment excerpts and task
titles, none of which belongs in a push payload the OS logs.

**Push has no idempotency guard.** Expo's message format has no key for it
(`id` appears only on the ticket it returns), so if the `SENT` write fails after
a successful send, the delivery re-queues and the phone is notified again. The
`dedupeKey` is passed as `collapseId` instead, which makes the repeat *replace*
the earlier notification on the device rather than stack beside it. Email has a
real guard via Resend; push does not.

**`expo-server-sdk` is not used.** It is the official client, but it is ESM-only
(`"type": "module"`) and ts-jest cannot require it — the same wall this codebase
already hit with svix. `ExpoPushTransport` speaks to
`https://exp.host/--/api/v2/push/send` over `fetch` instead; the endpoint, the
request shape, the 100-recipient chunk limit and the `DeviceNotRegistered`
sentinel were all read off `expo-server-sdk@7.2.0` rather than recalled.

### What push does not have yet

- **No push preference UI.** `NotificationPreference` carries the channel, and
  the existing `GET/PUT /boards/:id/notification-preferences` is scoped to
  `EMAIL` explicitly, so its DTO is unchanged and `apps/web` needed no edit.
  Nothing yet lets anyone mute push *specifically*.

  Because of that, **a push row reads the email preference when it has no row of
  its own.** Otherwise muting a category would leave the phone buzzing with no
  API to stop it — a consent control that silently lost half its meaning.
  Someone who mutes "mentions" means it. An explicit `PUSH` row wins once a
  screen exists to write one.
- **An email unsubscribe link writes an `EMAIL` row.** It is still honoured by
  push through the fallback above, which is the conservative reading of one
  click. A future push-preferences screen is what lets the two diverge.

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

Stored per user **per board, per channel** — someone in two bands can be loud
in one and quiet in the other, and loud on their phone while quiet in their
inbox. Categories are coarser than triggers on purpose:

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

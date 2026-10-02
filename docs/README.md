# Artist Dashboard — Feature Documentation

Reference docs for *what the product does* and the rules behind it, one file per
feature area. This is the behavioural spec: what fires when, who can do what,
and which edge cases were decided deliberately.

For the module map and stack overview read the root [README.md](../README.md);
for build conventions and skills read [CLAUDE.md](../CLAUDE.md). Those describe
*how we build*. These describe *what we built*.

## Conventions for this directory

- **One file per feature area**, named after the area (`notifications.md`,
  `permissions.md`). Cross-link rather than repeat.
- **Document decisions, not code.** If a reader can get it from the type
  signature, leave it out. If someone would reasonably ask "why does it do
  that?", write it down.
- **Mark what isn't built yet.** A spec written ahead of the code is useful; a
  spec that silently lies about what ships is not. Use a status line.
- **Keep the trigger/permission tables authoritative.** When behaviour changes,
  the table changes in the same PR.

## Contents

| Area | Status |
|---|---|
| [Notifications](notifications.md) — every trigger, recipient, channel, and suppression rule | Email shipped; push plumbed, not yet reachable |
| [Mobile app](mobile-app.md) — the Expo/React Native app: phase tracker, navigation design, locked decisions | In progress — P0–P4 done, P5–P8 built and awaiting verification |
| [Feature test checklist](test-checklist.md) — what a person must click and see work, per phase | Live — P1–P4 listed |
| Permissions — the `can()` map, role matrix, and where each action is enforced | Not yet written |
| Tasks — statuses, subtasks, assignees, checklists, ordering | Not yet written |
| Planning — goals, events, reminders, focus pins, calendar | Not yet written |
| Dashboard — the widget grid, personal vs. default layouts, the widget registry | Not yet written |
| Comments & attachments — markdown, mentions, the signed-URL upload flow | Not yet written |
| Archive — the two-tier archive/delete model and its cascade rules | Not yet written |
| Board appearance — palettes and per-widget colour slots | Not yet written |

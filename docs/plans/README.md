# Implementation plans

Plans in this folder are the shared working documents for Claude and Codex. They
are ordinary Markdown files in the repo, so Git is the source of history and
Obsidian can open this folder as a vault without keeping a separate copy.

## Index

| Plan | State | Trello |
|---|---|---|
| [Plan template](TEMPLATE.md) | Ready to copy | — |

Add one row per plan. Keep the plan in this repo and link to the corresponding
Band Board cards from the plan; put the plan path and task ID in each card so
the connection works in both directions.

## Task IDs and Trello cards

- Give each plan a short, unique prefix based on its topic, such as `MOB` or
  `AUTH`. Choose it once and keep it stable.
- Number actionable tasks within that plan: `MOB-001`, `MOB-002`, and so on.
  Never reuse an ID, even if a task is removed; mark it cancelled in the plan.
- Make one Trello card for each actionable task. Use the task ID at the start
  of the card title, for example `MOB-001 — Add offline task drafts`.
- In the card description, include the plan path, task ID, and a link to the
  relevant heading/anchor. In the plan's task row, record the Trello card link.
- Keep the plan as the source for intent, scope, and decisions. Keep the card as
  the source for execution state, checklist, and test evidence. If scope changes,
  update both and note the change in the card.

## Workflow on the Band Board

- When work starts, move the existing card to **Dev**. Do not create a duplicate
  if a card with that task ID already exists.
- When implementation is built, move it to **Testing** and comment with the
  commit hash, what changed, and how to test it. Add phase-level verification
  checklists to the relevant testing card when the repo workflow calls for one.
- Only the user moves cards to **Done**. When the user confirms a check in chat,
  tick that item on Trello and reflect the result in the plan if it changes the
  durable record.
- When a plan has no cards yet, leave card links blank until its tasks are
  reviewed and ready to track. Do not create placeholder cards for whole plans.

## Importing plans from Claude

Copy/export each plan's Markdown into this folder, preserve its original content
first, then add the file to the index. Assign the stable prefix and task IDs
without changing the plan's decisions. Add Trello links after matching or
creating cards for its actual actionable tasks. Note the original Claude plan
title or source in the plan metadata when that context matters.

Copy [TEMPLATE.md](TEMPLATE.md) when starting a new plan.

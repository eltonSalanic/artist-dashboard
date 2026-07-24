# Phase 5 — Change Suggestions

Tracking list for post-P5 change requests. Work through top-to-bottom, hard stop for user verification after each.

- [x] **1. Assignee icon sizing** — the assignee icon is slightly too big for the box in the expanded widget view
- [x] **2. Remove markdown support** — musicians don't need it; drop markdown rendering/editing from comments
- [x] **3. Permanent "Mentions" notification** — add a persistent Mentions notification indicator up top
  - New `MentionNotification` table (migration `20260723203438_mention_notifications`); rows created on comment create for each mentioned member except the author. Indicator only appears when you have unseen mentions; open/remove each, or Clear all.
  - Note: only *newly created* comments notify; editing a comment to add a mention does not (kept scope tight).
- [x] **4. Auto-assign on "My Tasks" create** — adding a new task through "My Tasks" should auto-assign the current user's account
- [x] **5. Status-edit restricted to assignees** — users can only change task status on tasks assigned to them
- [~] **6. Filter tasks by status**
  - [x] 6a. Calendar filter by item type — Shows / Meetings / Rehearsals / Tasks / Reminders (+ Goals for completeness); client-side toggle chips.
- [x] **7. Remove users from board** — allow admins to remove members from a board

# Phase 6 — Polish

Work top-to-bottom, hard stop for user verification after each.

- [x] **1. Permission-matrix audit** — cross-checked `can()` map ↔ every endpoint `@BoardRoles` ↔ client UI gating. **Result: no drift, no code changes.** Two harmless observations: `task.create` guarded at service layer not guard layer (intentional, enables admin auto-assign create); `status.manage` action defined but unused client-side (statuses card is Settings-admin-gated instead).
- [x] **2. Empty states** — audited every widget/list/page. Already comprehensive from earlier phases (all widgets use `Empty`; comments/attachments use appropriate inline "No … yet" copy; focus widget shows "Not set" per slot). No changes needed.
- [x] **3. Skeletons** — audited: every `useQuery`/`useInfiniteQuery` component already renders a pending `Skeleton`. No changes needed.
- [x] **4. Toasts** — error coverage complete (every mutation hook has `onError` toast). Success toasts reserved for rare/consequential admin actions. Added one for parity: `toast.success("Task deleted")` on task/subtask delete.
- [x] **5. Demo seed** — `apps/api/prisma/seed.ts` builds a rich, idempotent "Neon Harbor" board (synthetic bandmates, 9 tasks across statuses w/ checklists+subtask, 3 goals, 4 events, reminders, comments+mention, custom widget, 10-entry feed across all 8 activity types). Owner resolves to a real account via `DEMO_OWNER_EMAIL` (defaults to smoke-test account). Run: `npm run db:seed -w apps/api`. Needed a ts-node ts-ext require hook (`prisma/ts-ext-loader.js`) + `prisma/tsconfig.seed.json` since the generated Prisma client uses `.js` specifiers.
- [x] **6. README** — added "What it does" feature overview + "Demo data" section documenting the seed.
- [ ] Install skills, project scoped for future devs

Deferred (not this phase): P5 item 6b — status filter on tasks/widget view.

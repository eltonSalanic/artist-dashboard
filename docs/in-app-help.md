# In-app help — explaining the rules

**Status:** built on the phone (2026-11-11). The web has the role-change API and the shared copy but no help UI yet.

Most of Band Wall explains itself. What doesn't are the *rules*: who can do what, how the books work, and a few words that mean something specific here. Those are explained where they bite, not in a tutorial: a one-time card on the hub, three (i) sheets, a help page, and empty and blocked states that say why and who to ask. There is no carousel and there are no coach marks (the hub is user-arranged, so anything pointing at a card would point at the wrong place).

## One source for the words

All of it lives in [packages/shared/src/help.ts](../packages/shared/src/help.ts), next to the permission map:

- `HELP_TOPICS` — five topics (`roles`, `books`, `shows`, `wall`, `bands`), each a title, a one-line summary and sections of a heading, a paragraph or a short list.
- The **role lists are built from `can()`**. Each line names the `Action` behind it, and whether it lands under "Everyone in the band can" or "Only admins can" is decided by `can('USER', action)`. Change the permission map and the help follows; `help.spec.ts` checks it.
- `roleIntro(role, isOwner)` — the title and sentence someone is told about their place in a band.
- `adminOnlyMessage(doing, adminNames)` — "Only admins can add or change a show. Ask Riley or Casey."
- `ROLE_LABELS`, `ROLE_ONE_LINERS` — "Member" / "Admin" and one line on each.

## Where it shows (phone)

| What | Where | Who sees it |
|---|---|---|
| **"How this band works" card** | Top of the hub | Everyone but the owner, once per band and role on that phone, until closed. A member reads what they can do and who the admins are; an admin reads what admins can do. Someone made an admin later sees the admin card once. Links to the roles and books sheets. |
| A help row on the **"Get set up" card** | Hub | The owner (who gets that card instead) |
| A role line on **"You're In"** | After joining with a code | New members |
| **(i) next to Role** | Settings → Invite someone, with one line on the picked role | Admins |
| **(i) on Members** | Settings → Members | Admins |
| **(i) on the band fund** | Finances card, which now names the number "BAND FUND" | Everyone |
| **How Band Wall works** | You tab → Help: every topic on one page, opening with your role in the band you're looking at | Everyone |

The (i) opens `/help/:topic`, a native sheet (two thirds high, pulls to full). It is the one sheet that scrolls, so it hides the sheet's bar and draws its "How it works" title itself, as the first of two siblings before the scroll view: with the bar, text scrolled up ran through its title, and react-native-screens sizes a sheet's scroll view to the whole sheet unless a header view sits right before it. The page is `/help`. Screens: `screens/help-sheet.tsx`, `screens/help.tsx`; pieces in `features/help/`.

The You tab's band card says "Member" or "Admin" (`ROLE_LABELS`), the words the help uses, rather than the stored `USER` / `ADMIN`.

## Copy that explains instead of blocking

- A form a member can't use says **who to ask**: "Only admins can add or change a show. Ask Riley or Casey." (`FormGate`). The task status sheet names the task's assignees, or the admins when it has none.
- **Show status sheet**: each status has a line under its name for what picking it does (pencilled in / counts as booked / left out of counts), since bands rename their statuses and "hold" is trade talk.
- **Empty states**: Finances says what to log and that out-of-pocket spending is owed back; Focus says what it's for while any period is unset; Shows mentions holds.
- **Paying back** says, on the button's hint and in the confirm, that it records the payment and sends no money.
- "Only admins see the books" is gone: members have been able to see the books since `finance.view` opened to everyone, so the line could never show and contradicted the rules.

## Changing a role

A role used to be fixed at invite time. Now any admin can change it: **Settings → Members → tap the role** → "Make admin" / "Make member", with a confirm that says what changes.

- `PATCH /boards/:id/members/:userId` with `{ role: 'ADMIN' | 'USER' }` (`updateMemberRoleSchema`), `@BoardRoles('ADMIN')`. Hook: `useUpdateMemberRole`.
- **Not yourself** (400), so the last admin can't lock the band out of its settings, and **not the owner** (403), who is always an admin. The owner's row shows an "Owner" badge instead of a role to tap.
- The members list is ordered by when people joined, then by membership id, so two people who joined at the same moment don't swap places when one changes role.
- Not in the activity feed: that needs a new `ActivityType`, which is a migration.
- The web settings page doesn't have the control yet.

## Not built

- Help UI on the web.
- A role change in the activity feed, or a push to the person whose role changed.

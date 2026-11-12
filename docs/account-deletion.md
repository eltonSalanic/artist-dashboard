# Deleting your account

> **Status:** built on `feat/delete-account`, phone only. Not tested on a device
> yet. Revoking Apple sign-in tokens is still a TODO (below).

The App Store requires an in-app way to delete an account in any app that lets
people make one (guideline 5.1.1(v)), and Sign in with Apple and Google both
make accounts. On the phone it's **You → Delete account**, under Sign out.

## The flow

1. The screen says what goes: the account and every band only you are in, for
   good. What you made in bands you share stays with the band.
2. If you have an App Store or Google Play subscription that renews, it says
   deleting the account doesn't cancel it, with a button to the store's
   subscription page. We can't cancel a store subscription for anyone.
3. You type **DELETE** to unlock the button.
4. `DELETE /me`. On success the phone forgets its push token and the Google
   account picked, signs out (the welcome screen) and says "Your account was
   deleted."
5. If you own a band other people are in, the API refuses (below) and the
   screen lists those bands, each opening its Settings, where you can hand it
   over to another member or delete it. Then you come back and try again.

## What happens to what (`DELETE /me`)

| What | Happens |
|---|---|
| A band you own with other members | **Blocks the deletion**: 409 `OWNS_SHARED_BANDS` with `boards: [{ id, name }]`. Hand it over or delete it first. |
| A band only you are in (owned by you, or by nobody) | Deleted with everything in it, files included, as when a band is deleted. |
| A band someone else owns | You leave it. It carries on. |
| Tasks, comments, files and links you made in bands that carry on | Kept, and moved to **Former member** (below). |
| Invites you sent | Kept, also under Former member, so a pending one still works. |
| Invites waiting for your email | Deleted, so signing up again with the same address doesn't pull you back into those bands. |
| Finance entries you created, handled or paid back; activity lines you were the actor of | Kept with no name on them (the columns were already `SET NULL`). |
| Memberships, layouts, notification settings and history, push devices, @-mention alerts, your subscription record | Deleted with the user row (cascade). |
| The sign-in account, its sessions and linked Apple / Google accounts | Deleted. Every session ends at once. |

It runs in one transaction. Stored files of the deleted bands are removed
after the commit: a failure there leaves orphaned files, never a half-deleted
account. `DELETE /me` isn't a band route, so a locked band (billing) never
stands in the way.

### Former member

Tasks, comments, uploads, links and invites all require an author, and some
deletes would otherwise either fail or take the band's own work with them. So
they move to one placeholder user, `Former member`
(`00000000-0000-4000-8000-000000000000`, `former-member@bandwall.invalid`),
created the first time it's needed. It has no sign-in account and no
membership, so nobody can sign in as it and it never shows in a member list.
It's how GitHub handles deleted users. Code: `FORMER_MEMBER` in
`apps/api/src/users/account-deletion.service.ts`.

Names written into text (an @-mention in a comment, a member's name in an
activity line) stay as they were written.

## Subscriptions

A store subscription keeps billing until it's cancelled in the store. The
screen shows the warning and the store link when the account's subscription
renews through the App Store or Google Play, and a plain note otherwise.
RevenueCat events for a deleted account are logged and ignored
(`unknown_user`), since the user row is gone.

## Not done yet

- **Revoking Apple tokens.** Apple expects an app with Sign in with Apple to
  revoke the person's tokens when they delete their account
  (`POST https://appleid.apple.com/auth/revoke`). That needs a client secret
  signed with the Sign in with Apple `.p8` key, which we don't have yet, and a
  refresh token from the sign-in, which the native flow doesn't send the API
  today. Marked `TODO(sign-in-with-apple)` in the service.
- **Web.** No delete-account UI on the web app yet; the route is ready for it.

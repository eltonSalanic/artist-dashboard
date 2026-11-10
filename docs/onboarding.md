# Onboarding — the first run

**Status:** built on `feat/onboarding-flow` (2026-10-30), merged into `main` 2026-11-02. Designed in the project's "Band Wall onboarding redesign" page; Elton kept the welcome, account and band steps, RevenueCat's own paywall, "You're live", and a smaller setup checklist.

Two kinds of new person arrive: someone **starting a band**, who pays, and someone **joining one**, who never does. The flow splits them on the first screen.

## Starting a band

| Step | Phone | Web |
|---|---|---|
| Welcome | `/welcome`, the first screen when signed out: [a looping preview](#the-welcome-preview-phone) above **Create A Band Wall**, **I've got an invite** and "Already in? Sign in" | The landing page; its Create account buttons go to `/login?mode=signup` |
| 1 of 3 · You | `/sign-in?mode=signup`: your name, email, password | `/login?mode=signup`: the same three fields |
| 1 of 3 · Check your email | "Check Your Email.": the 6-digit code mailed at sign-up (iOS offers it from Mail), with Send a new code and Use a different email | "Check your email": the same code field and buttons |
| 2 of 3 · Your band | "Name Your Band.": the name, a colour (one of the band palettes), and the band's block drawn as you type | The same, as a page with the preview on the right |
| 3 of 3 · Open it | RevenueCat's paywall (`presentPaywall`) | RevenueCat's paywall, or our two plan buttons if the offering has none |
| You're live | `/band-live`: "<Band> Is Open." in the band's colour, when the free month ends, and an invite field | `/live`: the same |
| First wall | A small "Get set up" card on the hub: invite your bandmates, add your next show, add a task | The same card above the dashboard |

- **The band is created after the purchase.** The API only creates a band for a subscriber (`402 SUBSCRIPTION_REQUIRED`, see [billing.md](billing.md)), so the name and colour wait on the device (AsyncStorage on the phone, localStorage on the web) until the purchase is confirmed, then `POST /boards` creates it with `{ name, palette }`. Closing the paywall, or the app, keeps the draft.
- **Already subscribed, or billing off:** Continue creates the band straight away.
- **"2 of 3"** shows only straight after signing up. Anyone else in no band (someone who left every band) sees the same screen without the step count.
- **The email is confirmed before anything else.** Sign-up gives no session until the 6-digit code is entered; the code signs the person in and the flow carries on at step 2. Codes last an hour, allow three wrong tries and work once. Signing in to an account that never confirmed mails a fresh code and opens the same step. Accounts made before this (2026-11-10) were marked confirmed by the migration `confirm_existing_emails`. See [Sign-up codes](notifications.md#sign-up-codes).
- **Your name** goes to Better Auth at sign-up, and `POST /me/bootstrap` starts the user's display name from it (it used to be the start of the email). `PATCH /me` with `{ displayName }` changes it later.
- **The setup card** is the owner's only. Each row ticks itself from the band's data: invited (another member or a pending invite), a show (any event), a task. "Invite your bandmates" opens Settings already at the invite section (`/board/:id/settings?section=invite` on the phone, `/settings#invite` on the web, which also puts the cursor in the email field). It hides when all three are done or when the owner closes it (remembered per band on that device).
- Creating a second band from the band switcher is unchanged: `/subscribe` on the phone, the Create a band dialog on the web.

## The welcome preview (phone)

`/welcome` plays a band's wall building itself, like a Spotify Wrapped story, with the three actions fixed underneath. It's five beats, about 18 seconds, on a loop:

1. "Welcome to / Band Wall." stamps onto the band's colour, which then lifts away like a curtain.
2. "Every Event." sweeps across the page as the band's name slides into the hub masthead, then the first real hub cards land.
3. "Who's Doing What." sweeps across first, then the task cards land.
4. The last cards land under "Track Expenses." as the camera rides down the wall.
5. The wall shrinks into a tilted phone on the band's colour, under "It all lives on Band Wall."

- **The band changes every loop.** There are 27 real bands, Turnstile first, each with its own palette. Only the Shows and Notes cards change per band (the next show, and a setlist); the rest is the same demo numbers. A line under the buttons says the bands don't endorse Band Wall.
- **The cards are the real thing:** `HubStatCard`, and the masthead from `features/board/masthead.tsx`, the one the hub uses, so the preview can't drift from what someone gets.
- **The status bar, progress bars and buttons** sit on the band's colour during the first and last beats, and on the page's colours between. They switch only once the lifting card has cleared them.
- **Tap** the right side to skip a beat, the left to go back; back restarts the beat unless it has only just begun. Screen readers get the same steps as an adjustable control.
- **Reduce Motion** holds a still frame for each beat, changing on the same rhythm.
- It only runs while the screen is focused, so it stops under sign-in.

The code is in `apps/mobile/src/features/onboarding/wall-intro/`: `timeline.ts` works out everything from a single clock (with tests in `timeline.spec.ts`), `bands.ts` holds the bands, and `demo-wall.ts` the cards and headlines.

## Joining with an invite (phone)

**I've got an invite** opens `/sign-in?mode=invite`: email, the 6-digit code from the invite email, your name, a password. Verifying signs them in; the password and name (`PATCH /me`) are saved straight after. The hub then shows `/welcome-in` once: "You're In <Band>." in the band's colour, and that the owner's subscription covers them. On the web, invites still arrive through the email link and `/auth/callback`.

## Not built

- The trial reminder on day 25 that the design page promised.
- Moving the push-notification ask to after the first show is added (it still lives on the Inbox tab).
- A web "I've got an invite" door on the login page; the email link covers the web.

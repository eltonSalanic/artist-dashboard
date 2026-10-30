# Onboarding — the first run

**Status:** built on `feat/onboarding-flow` (2026-10-30), not merged. Designed in the project's "Band Wall onboarding redesign" page; Elton kept the welcome, account and band steps, RevenueCat's own paywall, "You're live", and a smaller setup checklist.

Two kinds of new person arrive: someone **starting a band**, who pays, and someone **joining one**, who never does. The flow splits them on the first screen.

## Starting a band

| Step | Phone | Web |
|---|---|---|
| Welcome | `/welcome`, the first screen when signed out: "Your band's whole life, one wall.", **Start a band**, **I've got an invite**, Sign in | The landing page; its Create account buttons go to `/login?mode=signup` |
| 1 of 3 · You | `/sign-in?mode=signup`: your name, email, password | `/login?mode=signup`: the same three fields |
| 2 of 3 · Your band | "Name Your Band.": the name, a colour (one of the band palettes), and the band's block drawn as you type | The same, as a page with the preview on the right |
| 3 of 3 · Open it | RevenueCat's paywall (`presentPaywall`) | RevenueCat's paywall, or our two plan buttons if the offering has none |
| You're live | `/band-live`: "<Band> Is Open." in the band's colour, when the free month ends, and an invite field | `/live`: the same |
| First wall | A small "Get set up" card on the hub: invite your bandmates, add your next show, add a task | The same card above the dashboard |

- **The band is created after the purchase.** The API only creates a band for a subscriber (`402 SUBSCRIPTION_REQUIRED`, see [billing.md](billing.md)), so the name and colour wait on the device (AsyncStorage on the phone, localStorage on the web) until the purchase is confirmed, then `POST /boards` creates it with `{ name, palette }`. Closing the paywall, or the app, keeps the draft.
- **Already subscribed, or billing off:** Continue creates the band straight away.
- **"2 of 3"** shows only straight after signing up. Anyone else in no band (someone who left every band) sees the same screen without the step count.
- **Your name** goes to Better Auth at sign-up, and `POST /me/bootstrap` starts the user's display name from it (it used to be the start of the email). `PATCH /me` with `{ displayName }` changes it later.
- **The setup card** is the owner's only. Each row ticks itself from the band's data: invited (another member or a pending invite), a show (any event), a task. It hides when all three are done or when the owner closes it (remembered per band on that device).
- Creating a second band from the band switcher is unchanged: `/subscribe` on the phone, the Create a band dialog on the web.

## Joining with an invite (phone)

**I've got an invite** opens `/sign-in?mode=invite`: email, the 6-digit code from the invite email, your name, a password. Verifying signs them in; the password and name (`PATCH /me`) are saved straight after. The hub then shows `/welcome-in` once: "You're In <Band>." in the band's colour, and that the owner's subscription covers them. On the web, invites still arrive through the email link and `/auth/callback`.

## Not built

- The trial reminder on day 25 that the design page promised.
- Moving the push-notification ask to after the first show is added (it still lives on the Inbox tab).
- A web "I've got an invite" door on the login page; the email link covers the web.

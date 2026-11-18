---
type: decision
description: Read before adding a game or a route, deciding which platforms a feature ships on, or changing join links and how the app opens them.
version: 1.0.0
status: accepted
date: 2026-11-11
---

# Ship every game on web and mobile

Arcade Club has two clients for one Convex backend: the web app (`src/`) and the
phone app (`apps/mobile/`). Nothing said which games and screens belong on which,
so the app grew a subset (`APP_GAMES`) while new games kept landing on the web only.
The [platform-parity standard](https://github.com/AppElent/developer-tools/pull/63)
asks each project to record its platform goals once and list every exception.

Web and mobile are equal: neither leads. The goal is full parity, so every game
works on both.

- **A new game ships on web and mobile at the same time.** It may reach the app as
  an Expo DOM component (`"use dom"`) to start. A game that cannot ship on both does
  not ship.
- **Existing web-only games are `pending-port`.** They stay on the web, with no
  deadline, until Eric decides which to keep ([APP-49](https://linear.app/appelent/issue/APP-49)). A kept game is ported as a DOM
  component first and rewritten natively later.
- **Floor**, on both platforms and not reduced: sign-in, sign-up and password reset;
  account and profile editing; account deletion; data export; language; theme; the
  privacy page. The app shows the privacy page in an in-app browser.
- **Share target:** the join link, `https://<web host>/join?token=…` (or `?code=…`).
  It works in a browser for someone without the app. The app accepts the same link
  through its own scheme (`arcadeclub://join?token=…`) and shares the web URL.
- **The web is responsive first.** No page is marked `large-screen`.
- **One web client.** Web is not a build or deploy target for the app: no web
  script, no web export, no web config. `react-native-web` may still arrive as a
  dependency of Expo DOM components.
- **Web exclusives**, by design: `about` (for visitors without the app),
  `dashboard` (the hosts' desk: stats, past results and CSV reports) and
  `workbench` (pasting and approving generated content, which is keyboard work).

`packages/core/src/features.ts` is the source of truth for which feature is on which
platform, and `scripts/feature-manifest.test.ts` fails CI when a route file is not
in it. `APP_GAMES` keeps the app's wiring only; its test requires exactly the games
the feature list puts on mobile.

Open gaps are the `pending-port` entries in `packages/core/src/features.ts`.

## Universal links

Shipped on iOS ([APP-48](https://linear.app/appelent/issue/APP-48)), under the
shared app-links standard. Production and Preview builds claim
`https://arcade-club.appelent.nl/join` (`?token=` or `?code=`); Development builds
claim nothing. `apps/mobile/src/lib/app-links.ts` is the one list of claimed links:
`app.config.ts` takes `ios.associatedDomains` from it, `app/+native-intent.tsx` routes
through it (only a valid share token or room code reaches the join tab; any other web
link opens home), and `scripts/app-links.test.ts` keeps
`public/.well-known/apple-app-site-association` in step with it. Joining works signed
out, so no link has to wait for sign-in. When the app meets a game it cannot play, it
opens the web join page in an in-app browser (`openWebPage`), never through
`Linking.openURL`, which would hand the claimed link straight back to the app.

Android app links wait until the app ships Android builds
([APP-273](https://linear.app/appelent/issue/APP-273)).

## Consequences

- A new game needs a `features.ts` entry listing both platforms, and app wiring in
  `APP_GAMES`; the tests fail until both agree.
- A new route needs a feature, or CI fails.
- A platform-only feature needs a reason in `features.ts`; floor features and share
  targets can only be `exclusive` by changing this decision.

## Rejected

- Web leads and the app carries a subset: that is how the app drifted. With equal
  platforms, a game missing from either is a gap, not a choice.
- Expo web as the web client: the TanStack Start app already is one, and two web
  clients would drift.

## Reopen when

- Eric decides which web-only games to keep ([APP-49](https://linear.app/appelent/issue/APP-49)): drop the rest, port the kept ones.
- A game or screen cannot reasonably work on a phone.
- The app ships Android builds, to add Android app links ([APP-273](https://linear.app/appelent/issue/APP-273)).

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

Not shipped yet ([APP-48](https://linear.app/appelent/issue/APP-48)). The app could open a claimed `https://arcade-club.appelent.nl/join?token=…`
link: Expo Router matches `/join` to `app/(tabs)/join/index.tsx`, which reads `token`
and `code`, so no `+native-intent` is needed. But the Apple Team ID for
`apple-app-site-association` is not in the repo, and Android app links need the Play
App Signing SHA-256, so neither is configured. Only `/join` will be claimed. When the
app meets a game it cannot play, it opens the web join page in an in-app browser
(`openWebPage`), never through `Linking.openURL`, which would hand a claimed link
straight back to the app.

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
- The Apple Team ID and Play signing SHA-256 are available, to ship universal links
  and app links ([APP-48](https://linear.app/appelent/issue/APP-48)).

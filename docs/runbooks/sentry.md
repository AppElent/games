---
type: runbook
description: Read when changing error reporting or investigating an Arcade Club error in Sentry.
version: 1.3.0
---

# Sentry

All surfaces report to one project, `appelent/arcadeclub` (id `4512351895552000`),
told apart by the `app` tag: `arcadeclub-mobile`, `arcadeclub-web`,
`arcadeclub-web-server` and `arcadeclub-convex`. The shared
[Sentry standard](../standards/sentry-monitoring.md) covers privacy and per-surface
rules; [environment.md](environment.md) covers where the DSN and token come from.

| Surface | Code | What it sends |
| --- | --- | --- |
| Mobile | `apps/mobile/src/observability/` | Errors and feedback. See [mobile.md](mobile.md#error-reporting). |
| Browser | `src/instrument.client.ts`, `src/client.tsx` | React and unexpected Convex write failures, the route template as `screen`, feedback. |
| Worker | `src/server.ts` | SSR exceptions and 5xx responses. |
| Convex | `scripts/convex-sentry.mjs` | Failed executions, from `convex logs`. |

Errors only: no tracing, replay, profiling or console logs. A keyed `ConvexError`
(`roomNotFound`) is an expected outcome the UI shows and is not reported. Reports carry
only the opaque Clerk user id; emails, tokens and query strings are filtered.

Local runs never report: the browser and Worker skip localhost, and development
bundles are off (mobile: unless `EXPO_PUBLIC_SENTRY_DEBUG=1`).

## Feedback

Web Account and mobile Profile have **Report a problem**; on the phone a shake opens
it too. The form is English or Dutch (labels in `@arcadeclub/core` `common.feedback`),
has no name or email field, and takes an optional screenshot (a picked image on the
web, one the player takes on the phone). Feedback skips `beforeSend`, so
`sanitizeFeedbackEvent` runs as an event processor on both. The row is hidden in
builds that don't report.

## Source maps

`pnpm build` writes hidden maps, uploads them when `SENTRY_AUTH_TOKEN` is set (release
is `arcadeclub@<version>+<short sha>`, or `SENTRY_RELEASE`), and `scripts/generate-sw.mjs` deletes the public
client copies. Without a token the upload is skipped. EAS builds upload native and JS
maps through the Expo plugin with the EAS secret.

## Convex forwarder

The free plan has no managed Convex integration, so a reader forwards failed
executions (including scheduled functions). The script is the toolkit's forwarder
([sentry-monitoring setup](../standards/sentry-monitoring/setup.md)), copied unchanged;
the `app` tag defaults to `arcadeclub-convex` from the package name. It replays the
last 100 entries on restart, skips failures Convex will retry, and deduplicates by a
stable event id; it has no durable queue, so failures while it is down are lost. Run
one reader per deployment, and stop it if you adopt managed reporting.

### Production

Production failures are forwarded by the shared
[incident inbox](https://github.com/AppElent/developer-home/blob/main/services/incident-inbox/README.md) in `AppElent/developer-home`, not by this repo's
script (since 17 Nov 2026). One launchd agent on Eric's always-on Mac,
`com.appelent.incident-inbox` (run from `~/Developer/.services/developer-home`),
reads `eric-jansen:games:prod` with the logged-in Convex CLI and sends failed executions to this
app's Sentry project with the same `app=arcadeclub-convex` tag and
`environment=production`. Its incident poll then files each new Sentry issue in
Linear (team `APP`, labels `app:arcade` and Source `convex`). Events are grouped
by throwing function and message, so one helper failing under several queries
is one Sentry issue; the `func` tag still names the query.

- Log: `~/Library/Logs/incident-inbox.log`. A healthy start logs
  `convex arcade: reading eric-jansen:games:prod`.
- Restart: `launchctl kickstart -k "gui/$(id -u)/com.appelent.incident-inbox"`.
- Deployment, tag and DSN (`SENTRY_DSN_ARCADE`) are set in the inbox's `config.mjs` and
  its env file; change them there, not here.

Do not run `pnpm sentry:convex` against production while the inbox runs:
Sentry would get each failure twice. The old per-app agent
`com.appelent.convex-sentry.arcade`, its clone `~/Developer/.services/games`
and the `convex-sentry-run` wrapper are retired
([APP-98](https://linear.app/appelent/issue/APP-98), [APP-222](https://linear.app/appelent/issue/APP-222)).

### Manual runs

For a one-off or a dev deployment, run the reader in a checkout:

```sh
pnpm env:exec local -- pnpm sentry:convex --deployment zany-parakeet-507
```

`env:exec local` sets `SENTRY_CONVEX_DSN` (`local-tooling`) to the public project DSN
(Infisical `sentry-dsn`, the same value as `VITE_SENTRY_DSN`). It needs Convex CLI
auth. Do not read production by hand: the incident inbox already does, and two
readers send each failure twice.

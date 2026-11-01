# Environment contract

[`env.manifest.ts`](../../env.manifest.ts) is the source of truth for which value each
web, mobile, Convex and CI consumer reads. The `pnpm env:*` aliases run the
`scripts/env.mjs` engine; see the [shared guide](../standards/environments.md).

The app has four environments:

| Environment | Web | Convex | EAS |
| --- | --- | --- | --- |
| `local` | `pnpm dev`, `.env.local` | local backend (`convex dev`) | `development` |
| `preview` | Worker `games-pr-<n>` | `eric-jansen:games` preview (web); `chatty-ram-217` (iOS app) | `preview` |
| `dev` | Worker `games-dev` | `zany-parakeet-507` | `development` |
| `production` | Worker `games` | `chatty-ram-217` | `production` |

## Source

Values live in the shared Infisical project (`.infisical.json` holds only its id). The
lookup order is `/`, then `/arcade-club`; a value in the app folder overrides the root.
`local` and `dev` read the Infisical `dev` environment, `preview` reads `staging` and
`production` reads `prod`, as in the other Appelent apps. `staging` carries the production
Clerk instance, so PR web previews and the preview iOS app sign in against prod Clerk;
the iOS app also talks to the production Convex deployment and web origin
(`staging /arcade-club` holds the prod values), while each web preview gets its own
Convex preview deployment. `/arcade-club` holds the app's own values: `sentry-dsn`,
`sentry-auth-token`, `convex-url` and `web-origin`.

Static commands need no Infisical login:

```sh
pnpm env:check
pnpm env:generate   # rewrites .env.example
```

Provider reads and writes are explicit. Inspect the plan first:

```sh
pnpm env:plan production
pnpm env:apply production --only eas
```

## Supplied values

Some placements are produced by tools, not copied from Infisical:

- `CONVEX_DEPLOYMENT` and `VITE_CONVEX_URL` in the root `.env.local` come from
  `pnpm exec convex dev`.
- `EXPO_PUBLIC_CONVEX_URL` in `apps/mobile/.env.local` is set by hand: the dev
  deployment for a phone, or a local backend a simulator can reach (see
  [mobile.md](mobile.md)).
- The preview and deploy workflows get `VITE_CONVEX_URL` from `convex deploy`. The
  preview workflow uses the existing repo-level `CONVEX_DEPLOY_KEY` secret.

`pnpm env:apply production` writes the deploy workflow's values into the `production`
GitHub Environment: `CONVEX_DEPLOY_KEY` (a `prod:` key for `chatty-ram-217`, from
Infisical `prod` `/arcade-club` `convex-deploy-key`), `CLOUDFLARE_*`,
`SENTRY_AUTH_TOKEN` and the public `VITE_*` values. The workflow refuses any key
without the `prod:` prefix, since a missing Environment secret would otherwise fall
back to the repo-level preview key. `pnpm deploy:prod` runs the same
`deploy:production` script locally with those values from Infisical.

`pnpm env:apply preview` writes the preview workflow's GitHub values: secrets for
`SENTRY_AUTH_TOKEN` and `CLOUDFLARE_*`, and repo variables for the public values. The
Clerk key keeps its workflow name, `PREVIEW_CLERK_PUBLISHABLE_KEY`. The test-user
email and password are public client values (Vite and Metro inline them) and land only
in local and dev builds.

Existing hand-written `.env.local` files stay untouched; apply refuses to overwrite a
file without the generated marker. The engine records only variable names in
`.appelent/env-state.json` (ignored by Git).

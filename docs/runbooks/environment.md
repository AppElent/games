# Environment contract

[`env.manifest.ts`](../../env.manifest.ts) is the source of truth for which value each
web, mobile, Convex and CI consumer reads. The `pnpm env:*` aliases run the
`scripts/env.mjs` engine; see the [shared guide](../standards/environments.md).

The app has four environments:

| Environment | Web | Convex | EAS |
| --- | --- | --- | --- |
| `local` | `pnpm dev`, `.env.local` | local backend (`convex dev`) | `development` |
| `preview` | Worker `games-pr-<n>` | `eric-jansen:games` preview | `preview` |
| `dev` | Worker `games-dev` | `zany-parakeet-507` | `development` |
| `production` | Worker `games` | `chatty-ram-217` | `production` |

## Source

Values live in the shared Infisical project (`.infisical.json` holds only its id). The
lookup order is `/`, then `/arcade-club`; a value in the app folder overrides the root.
`local`, `preview` and `dev` read the Infisical `dev` environment, `production` reads
`prod`. `/arcade-club` holds the app's own values: `sentry-dsn`, `sentry-auth-token`,
`convex-url` and `web-origin`.

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
- `EXPO_PUBLIC_CONVEX_URL` in `apps/mobile/.env.local` is set by hand to the local
  backend address the device can reach (see [mobile.md](mobile.md)).
- The preview workflow gets `VITE_CONVEX_URL` from `convex deploy`, and uses the
  existing `CONVEX_DEPLOY_KEY` GitHub secret.

The preview workflow keeps its existing secret names, including
`PREVIEW_CLERK_PUBLISHABLE_KEY`. The test-user email and password are public client
values (Vite and Metro inline them) and never land in production.

Existing hand-written `.env.local` files stay untouched; apply refuses to overwrite a
file without the generated marker. The engine records only variable names in
`.appelent/env-state.json` (ignored by Git).

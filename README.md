# Arcade Club

Arcade Club is a real-time games web app built with TanStack Start, Clerk, and Convex.

## Features

- Live Quiz rooms with a host screen, join code, and player devices.
- Backgammon challenge links for direct two-player games.
- Game catalog with future games including Sudoku, Chess, Hitster, and Word Games.
- Guest-friendly joining with signed-in ownership for saved sessions.

## Tech Stack

- React 19 and TanStack Start
- Convex real-time backend
- Clerk authentication
- Tailwind CSS v4
- Biome and Vitest
- Cloudflare Workers deployment

## Setup

This project uses [pnpm](https://pnpm.io) — never npm or yarn.

1. Copy `.env.example` to `.env.local` and fill in the values (Clerk publishable key, Convex deployment/URL — see `.cta.json` or run `pnpm exec convex dev` to provision one).
2. `@appelent/auth` is installed from a private GitHub Packages registry. Add a token with `read:packages` scope to your **user-level** `~/.npmrc` (never the project's committed `.npmrc`, which only maps the registry):
   ```
   //npm.pkg.github.com/:_authToken=${NODE_AUTH_TOKEN}
   ```
   with `NODE_AUTH_TOKEN` exported in your shell before running install.
3. `pnpm install`

## Development

Run Convex and Vite together, watching both:

```bash
pnpm run dev:watch
```

Or push Convex functions once and run Vite alone:

```bash
pnpm run dev:all
```

## Verification

```bash
pnpm run check
pnpm run typecheck
pnpm test
pnpm run build
```

## Deployment

Deploys to Cloudflare Workers (`games` in prod, `games-dev` for the dev environment) via Wrangler:

```bash
pnpm run deploy:dev    # wrangler deploy --env dev
pnpm run deploy:prod   # convex deploy && build && wrangler deploy
```

Pull requests also get an isolated preview (per-PR Convex backend + Cloudflare Worker) via `.github/workflows/preview.yml`.

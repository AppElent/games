# Arcade Club

Arcade Club is a real-time games web app built with TanStack Start, Clerk, and Convex.

## Features

- Room games with a host screen and player phones: Live Quiz, Music Timeline, Bluff Dice, Signal Words and card games.
- Two-player challenge links: Backgammon, Chess and Connect Four.
- Solo puzzles: Sudoku (classic, killer, binary), Word Links and Squad Surge.
- Guest-friendly joining with signed-in ownership for saved sessions.
- An Expo mobile app (`apps/mobile`) that shares rules and text through `packages/core`.

## Tech Stack

- React 19 and TanStack Start
- Convex real-time backend
- Clerk authentication
- Tailwind CSS v4
- Biome and Vitest
- Cloudflare Workers deployment

## Setup

This project uses [pnpm](https://pnpm.io) — never npm or yarn.

1. `pnpm install`
2. `pnpm env:apply local` writes `.env.local` from Infisical, and `pnpm exec convex dev` adds the Convex deployment and URL. See `docs/runbooks/environment.md`.

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
pnpm run deploy:dev    # builds and deploys the games-dev Worker
pnpm run deploy:prod   # convex deploy && build && wrangler deploy
```

Pull requests labelled `preview:web` get an isolated preview (per-PR Convex backend + Cloudflare Worker) via `.github/workflows/preview.yml`.

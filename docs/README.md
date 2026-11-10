# Docs map

Each document's frontmatter `description` says when to read it. Types and locations
follow the [documentation standard](standards/documentation.md).

| Folder | Holds |
| --- | --- |
| [`contracts/`](contracts/) | How a feature behaves: [game sessions](contracts/game-sessions.md), [card games](contracts/card-games.md), [auth](contracts/auth.md), [mobile app](contracts/mobile-app.md) |
| [`runbooks/`](runbooks/) | Project facts for repeatable tasks: [verification](runbooks/verification.md), [deploy](runbooks/deploy.md), [environment](runbooks/environment.md), [mobile](runbooks/mobile.md), [Sentry](runbooks/sentry.md) |
| [`standards/`](standards/) | Shared standards installed by the toolkit; never edited here |
| [`adr/`](adr/) | Decisions, below |
| [`records/`](records/) | Evidence a contract or decision cites |

## Decisions

- [0001: Build card games from rule families and per-game config](adr/0001-card-games-use-rule-families-and-config.md)

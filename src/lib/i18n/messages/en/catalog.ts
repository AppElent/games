import { GAME_CATALOG, type GameType } from "#/lib/games/catalog";

export type CatalogText = {
	title: string;
	tagline: string;
	description: string;
	primaryAction: string;
	stats: string;
};

function textOf(type: GameType): CatalogText {
	const game = GAME_CATALOG.find((item) => item.type === type);
	if (!game) {
		throw new Error(`Unknown game type: ${type}`);
	}
	const { title, tagline, description, primaryAction, stats } = game;
	return { title, tagline, description, primaryAction, stats };
}

export const catalog = {
	"live-quiz": textOf("live-quiz"),
	backgammon: textOf("backgammon"),
	sudoku: textOf("sudoku"),
	chess: textOf("chess"),
	hitster: textOf("hitster"),
	"word-links": textOf("word-links"),
	"connect-four": textOf("connect-four"),
	"signal-words": textOf("signal-words"),
	"bluff-dice": textOf("bluff-dice"),
	"squad-surge": textOf("squad-surge"),
} satisfies Record<GameType, CatalogText>;

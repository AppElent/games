import type { GameType } from "@arcadeclub/core/games";

type GameStatsRow = {
	gameType: GameType;
	played: number;
	completed: number;
	won: number;
};

/**
 * Aggregates a user's participation rows into per-game stats. `won` counts
 * sessions whose winnerParticipantIds include the user's participant row.
 */
export function buildGameStats(
	rows: {
		session: {
			gameType: GameType;
			status: string;
			winnerParticipantIds?: string[];
		};
		participant: { _id: string };
	}[],
): GameStatsRow[] {
	const byGame = new Map<GameType, GameStatsRow>();
	for (const row of rows) {
		const entry = byGame.get(row.session.gameType) ?? {
			gameType: row.session.gameType,
			played: 0,
			completed: 0,
			won: 0,
		};
		entry.played += 1;
		if (row.session.status === "completed") {
			entry.completed += 1;
			if (row.session.winnerParticipantIds?.includes(row.participant._id)) {
				entry.won += 1;
			}
		}
		byGame.set(row.session.gameType, entry);
	}
	return [...byGame.values()].sort((a, b) => b.played - a.played);
}

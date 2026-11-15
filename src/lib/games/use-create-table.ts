import type { GameType } from "@arcadeclub/core/games";
import { useMutation } from "convex/react";
import type { FunctionReference } from "convex/server";
import { newTableSeatSecret, rememberTableSeat } from "#/lib/games/table-seat";
import { useHostSession } from "#/lib/games/use-host-session";
import type { Id } from "../../../convex/_generated/dataModel";

/** Against the computer, or a room for friends. */
export type TableMode = "computer" | "friends";

type CreateTable = FunctionReference<
	"mutation",
	"public",
	{
		seatSecret: string;
		joinMode: "solo" | "room";
		title: string;
		displayName: string;
		guestId?: string;
		gameId: string;
		options: string[];
		bots: number;
		start: boolean;
	},
	{
		sessionId: Id<"gameSessions">;
		participantId: Id<"sessionParticipants">;
	}
>;

/**
 * Opening a table game: against the computer it starts at once with bots in
 * the other seats, with friends it opens a room to share. This device keeps
 * the host's seat, then `open` goes to the table.
 */
export function useCreateTable(
	gameType: GameType,
	createTable: CreateTable,
	open: (sessionId: Id<"gameSessions">) => Promise<unknown>,
) {
	const create = useMutation(createTable);
	const { busy, error, host } = useHostSession(gameType, {
		open: ({ sessionId }) => open(sessionId),
	});

	function createTableAs(
		{
			gameId,
			title,
			mode,
			opponents,
			options,
		}: {
			gameId: string;
			title: string;
			mode: TableMode;
			opponents: number;
			options: string[];
		},
		fallback: string,
	) {
		const solo = mode === "computer";
		return host(async ({ displayName, guestId }) => {
			const seatSecret = newTableSeatSecret();
			const created = await create({
				seatSecret,
				joinMode: solo ? "solo" : "room",
				title,
				displayName,
				guestId,
				gameId,
				options,
				bots: solo ? opponents : 0,
				start: solo,
			});
			rememberTableSeat(
				created.sessionId,
				created.participantId,
				seatSecret,
				true,
			);
			return created;
		}, fallback);
	}

	return { busy, error, create: createTableAs };
}

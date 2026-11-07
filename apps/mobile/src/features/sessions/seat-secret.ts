/**
 * Which secret this phone keeps for a seat after joining a session. Only a card
 * table has seat secrets. A returning seat keeps the one it holds; otherwise the
 * new one goes along, so an account's seat can move to this phone.
 */
export function seatSecretAfterJoin(params: {
	gameType: string;
	participantId: string;
	seatClaimed: boolean;
	newSecret: string;
	existing?: { participantId: string; seatSecret?: string };
}) {
	const { gameType, participantId, seatClaimed, newSecret, existing } = params;
	if (gameType !== "card-games") return undefined;
	return existing?.participantId === participantId && !seatClaimed
		? existing.seatSecret
		: newSecret;
}

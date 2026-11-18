/**
 * One game's front door: who to play, how many opponents, which house rules.
 * Playing the computer needs no account; hosting friends does.
 */
import {
	type CardGameDefinition,
	type CardGameId,
	getCardGame,
	isCardGameId,
} from "@arcadeclub/core/cards/engine";
import {
	houseRuleSwitches,
	specialCardSwitch,
	specialCards,
} from "@arcadeclub/core/cards/table-view";
import { gameErrorMessage } from "@arcadeclub/core/errors";
import { initialHouseRules, setHouseRule } from "@arcadeclub/core/table-engine";
import { Stack, useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { haptics } from "../../../feedback/haptics";
import { plural, useI18n } from "../../../i18n";
import { Button } from "../../../ui/button";
import { Card } from "../../../ui/card";
import { ChoiceList } from "../../../ui/choice-list";
import { Notice } from "../../../ui/notice";
import { Screen } from "../../../ui/screen";
import { AppText } from "../../../ui/text";
import { onlineSessionHref } from "../../play/app-games";
import { OnlineScreenFrame } from "../../sessions/components/online-screen-frame";
import { HostGate } from "../../sessions/host/host-gate";
import { useHostSession } from "../../sessions/host/use-host-session";
import {
	HouseRuleSwitches,
	OpponentStepper,
	RuleSwitch,
	SetupSection,
} from "../../table/setup-fields";
import { PlayingCard } from "../deck/playing-card";
import { RulesSheet } from "../deck/rules-sheet";
import { useCardWords } from "../deck/use-card-words";

export function CardSetupScreen({ gameId }: { gameId: string }) {
	const router = useRouter();
	const { t } = useI18n();
	const cards = t.games.cards;
	if (!isCardGameId(gameId)) {
		return (
			<OnlineScreenFrame
				title={t.catalog["card-games"].title}
				blocked={cards.session.updateToPlay}
				blockedMessage={cards.session.updateToPlayHint}
				blockedAction={{
					label: cards.session.backToGames,
					onPress: () => router.replace("/cards"),
				}}
			/>
		);
	}
	return <Setup game={getCardGame(gameId)} gameId={gameId} />;
}

function Setup({
	game,
	gameId,
}: {
	game: CardGameDefinition;
	gameId: CardGameId;
}) {
	const router = useRouter();
	const { t, locale } = useI18n();
	const cards = t.games.cards;
	const text = cards.games[gameId];
	const hosting = useHostSession("card-games");
	const [mode, setMode] = useState<"computer" | "friends">("computer");
	const [opponents, setOpponents] = useState(Math.min(game.players.max - 1, 3));
	const [options, setOptions] = useState(() => initialHouseRules(game.options));
	const [rulesOpen, setRulesOpen] = useState(false);
	const words = useCardWords();
	const solo = mode === "computer";
	// Against the computer the table size is known; friends are still to come.
	const seats = solo ? opponents + 1 : null;
	const houseRules = houseRuleSwitches(words, game, seats);
	const special = useMemo(() => specialCards(words, game), [words, game]);
	const toggle = (id: string, on: boolean) =>
		setOptions((current) => setHouseRule(game.options, current, id, on));
	const headerOptions = useMemo(() => ({ title: text.name }), [text.name]);

	const create = async () => {
		const session = await hosting.host({
			joinMode: solo ? "solo" : "room",
			title: text.name,
			gameId,
			options,
			bots: solo ? opponents : 0,
			start: solo,
		});
		if (!session) return;
		haptics.moveMade();
		router.replace(onlineSessionHref("card-games", session.sessionId));
	};

	return (
		<>
			<Stack.Screen options={headerOptions} />
			<Screen>
				<AppText variant="secondary">{text.blurb}</AppText>
				<SetupSection label={cards.setup.modeLabel}>
					<ChoiceList
						choices={[
							{
								value: "computer",
								label: cards.setup.vsComputer,
								detail: cards.setup.vsComputerHint,
							},
							{
								value: "friends",
								label: cards.setup.withFriends,
								detail: cards.setup.withFriendsHint,
							},
						]}
						value={mode}
						onChange={setMode}
						accessibilityLabel={cards.setup.modeLabel}
						testID="cards-mode"
					/>
				</SetupSection>
				{solo ? (
					<SetupSection label={cards.setup.opponentsLabel}>
						<OpponentStepper
							value={opponents}
							min={game.players.min - 1}
							max={game.players.max - 1}
							label={plural(locale, opponents, cards.setup.opponents)}
							fewer={cards.setup.fewerOpponents}
							more={cards.setup.moreOpponents}
							onChange={setOpponents}
							testPrefix="cards"
						/>
					</SetupSection>
				) : null}
				{special.length > 0 ? (
					<SetupSection label={cards.setup.specialCards}>
						<AppText variant="caption">{cards.setup.specialCardsHint}</AppText>
						<Card>
							{special.map((card) => {
								const { on, disabled } = specialCardSwitch(
									card,
									options,
									seats,
								);
								const option = card.option;
								return (
									<RuleSwitch
										key={card.key}
										label={card.name}
										hint={card.effect}
										value={on}
										disabled={disabled}
										onChange={(next) => {
											if (option !== null) {
												toggle(option, card.adds ? next : !next);
											}
										}}
										leading={<PlayingCard card={card.sample} width={36} />}
										testID={`cards-power-${card.key}`}
									/>
								);
							})}
						</Card>
					</SetupSection>
				) : null}
				<HouseRuleSwitches
					heading={cards.setup.houseRules}
					rules={houseRules}
					chosen={options}
					onChange={toggle}
					testPrefix="cards"
				/>
				<Notice
					message={
						hosting.error
							? gameErrorMessage(t, hosting.error, cards.setup.couldNotCreate)
							: null
					}
				/>
				{!solo && !hosting.isSignedIn ? (
					<HostGate />
				) : (
					<Button
						label={solo ? cards.setup.playNow : cards.setup.openRoom}
						onPress={create}
						busy={hosting.busy}
						disabled={!solo && !hosting.canHost}
						testID="cards-create"
					/>
				)}
				<Button
					variant="plain"
					label={cards.setup.rulesButton}
					onPress={() => setRulesOpen(true)}
					testID="cards-rules"
				/>
			</Screen>
			<RulesSheet
				game={game}
				options={options}
				seats={seats}
				open={rulesOpen}
				onClose={() => setRulesOpen(false)}
			/>
		</>
	);
}

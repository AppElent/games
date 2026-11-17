/**
 * One dice game's front door: who to play, how many opponents, which house
 * rules. Playing the computer needs no account; hosting friends does.
 */
import {
	type DiceGameId,
	getDiceGame,
	isDiceGameId,
} from "@arcadeclub/core/dice/engine";
import { gameErrorMessage } from "@arcadeclub/core/errors";
import { initialHouseRules, setHouseRule } from "@arcadeclub/core/table-engine";
import { Stack, useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { haptics } from "../../../feedback/haptics";
import { plural, useI18n } from "../../../i18n";
import { Button } from "../../../ui/button";
import { CenteredState } from "../../../ui/centered-state";
import { ChoiceList } from "../../../ui/choice-list";
import { Notice } from "../../../ui/notice";
import { Screen } from "../../../ui/screen";
import { AppText } from "../../../ui/text";
import { onlineSessionHref } from "../../play/app-games";
import { HostGate } from "../../sessions/host/host-gate";
import { useHostSession } from "../../sessions/host/use-host-session";
import {
	HouseRuleSwitches,
	OpponentStepper,
	SetupSection,
} from "../../table/setup-fields";
import { DiceRulesSheet } from "../rules/dice-rules-sheet";

export function DiceSetupScreen({ gameId }: { gameId: string }) {
	const router = useRouter();
	const { t } = useI18n();
	const dice = t.games.dice;
	if (!isDiceGameId(gameId)) {
		return (
			<CenteredState
				title={dice.session.updateToPlay}
				message={dice.session.updateToPlayHint}
				action={{
					label: dice.session.backToGames,
					onPress: () => router.replace("/dice"),
				}}
			/>
		);
	}
	return <Setup gameId={gameId} />;
}

function Setup({ gameId }: { gameId: DiceGameId }) {
	const router = useRouter();
	const { t, locale } = useI18n();
	const dice = t.games.dice;
	const game = getDiceGame(gameId);
	const text = dice.games[gameId];
	const optionText = text.options as Record<
		string,
		{ label: string; hint: string }
	>;
	const hosting = useHostSession("dice-games");
	const [mode, setMode] = useState<"computer" | "friends">("computer");
	const [opponents, setOpponents] = useState(Math.min(game.players.max - 1, 1));
	const [options, setOptions] = useState<string[]>(() =>
		initialHouseRules(game.options),
	);
	const [rulesOpen, setRulesOpen] = useState(false);
	const solo = mode === "computer";
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
		router.replace(onlineSessionHref("dice-games", session.sessionId));
	};

	return (
		<>
			<Stack.Screen options={headerOptions} />
			<Screen>
				<AppText variant="secondary">{text.blurb}</AppText>
				<SetupSection label={dice.setup.modeLabel}>
					<ChoiceList
						choices={[
							{
								value: "computer",
								label: dice.setup.vsComputer,
								detail: dice.setup.vsComputerHint,
							},
							{
								value: "friends",
								label: dice.setup.withFriends,
								detail: dice.setup.withFriendsHint,
							},
						]}
						value={mode}
						onChange={setMode}
						accessibilityLabel={dice.setup.modeLabel}
						testID="dice-mode"
					/>
				</SetupSection>
				{solo ? (
					<SetupSection label={dice.setup.opponentsLabel}>
						<OpponentStepper
							value={opponents}
							min={game.players.min - 1}
							max={game.players.max - 1}
							label={
								opponents === 0
									? dice.setup.solo
									: plural(locale, opponents, dice.setup.opponents)
							}
							fewer={dice.setup.fewerOpponents}
							more={dice.setup.moreOpponents}
							onChange={setOpponents}
							testPrefix="dice"
						/>
					</SetupSection>
				) : null}
				<HouseRuleSwitches
					heading={dice.setup.houseRules}
					rules={game.options.map((option) => ({
						id: option.id,
						...optionText[option.id],
					}))}
					chosen={options}
					onChange={(id, on) =>
						setOptions((current) => setHouseRule(game.options, current, id, on))
					}
					testPrefix="dice"
				/>
				<Notice
					message={
						hosting.error
							? gameErrorMessage(t, hosting.error, dice.setup.couldNotCreate)
							: null
					}
				/>
				{!solo && !hosting.isSignedIn ? (
					<HostGate />
				) : (
					<Button
						label={solo ? dice.setup.playNow : dice.setup.openRoom}
						onPress={create}
						busy={hosting.busy}
						disabled={!solo && !hosting.canHost}
						testID="dice-create"
					/>
				)}
				<Button
					variant="plain"
					label={dice.setup.rulesButton}
					onPress={() => setRulesOpen(true)}
					testID="dice-rules"
				/>
			</Screen>
			<DiceRulesSheet
				game={game}
				options={options}
				open={rulesOpen}
				onClose={() => setRulesOpen(false)}
			/>
		</>
	);
}

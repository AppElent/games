import type { HitsterMode } from "../../../hitster";

/** Music Timeline (internal id `hitster`) UI chrome. Song titles, artist names, release
 * years and pack titles are content data and never routed through message keys. */
export const hitster = {
	modes: {
		instant: {
			label: "Instant Party",
			summary: "Place the song in the right spot. First to the target wins.",
		},
		original: {
			label: "Original",
			summary:
				"Place it in time. Name artist and title for a bonus token. Tokens pay for steals.",
		},
		pro: {
			label: "Pro",
			summary:
				"You only win the card with the right spot plus artist and title. No new tokens.",
		},
		expert: {
			label: "Expert",
			summary:
				"The right spot plus the exact year, artist and title. No new tokens.",
		},
		coop: {
			label: "Cooperative",
			summary:
				"One shared timeline and 5 team tokens. A wrong spot burns a token.",
		},
	} satisfies Record<HitsterMode, { label: string; summary: string }>,
	musicTimelineKicker: "Music Timeline",
	bits: {
		participantFallbackTeam: "Team",
		participantFallbackPlayer: "Player",
		timeline: {
			placeHereShort: "Place here",
			selectedSpot: "Selected spot",
			placeHere: "Place here (position {position})",
		},
		tokens: {
			teamCount: { one: "{count} team token", other: "{count} team tokens" },
			count: { one: "{count} token", other: "{count} tokens" },
		},
		scoreboard: {
			teamProgress: "Team progress",
			cardsProgress: "{cards} / {target} cards",
			standingsHeading: "Standings · first to {target}",
			winner: "Winner",
			cardsCount: { one: "{count} card", other: "{count} cards" },
			tokensAbbrev: "{count} tk",
		},
		rules: {
			listenTogetherHeading: "Listen together",
			listenTogetherBody:
				"The host plays a mystery track. Nobody sees the title, artist or year.",
			placeInTimeHeading: "Place it in time",
			placeInTimeBodyShared:
				"The active player drops the song into the shared team timeline.",
			placeInTimeBodySolo:
				"The active player drops the song into their own timeline.",
			revealScoreHeading: "Reveal and score",
			revealScoreBodyShared:
				"Correct keeps the card. Wrong burns a team token. Reach {target} cards before {tokens} tokens run out.",
			revealScoreBodySolo:
				"Correct placements grow your timeline. First to {target} cards wins.",
			earnTokensHeading: "Earn tokens",
			earnTokensBody:
				"Name artist and title for a bonus token (max {cap}). Spend a token to steal a missed card.",
			nameToClaimHeading: "Name it to claim it",
			nameToClaimBodyYear:
				"You only win the card with correct placement plus exact year, artist and title. No new tokens.",
			nameToClaimBodyNoYear:
				"You only win the card with correct placement plus artist and title. No new tokens.",
		},
		recap: {
			heading: "Round {round} recap",
			correctWord: "correct",
			wrongWord: "wrong",
			placementLine: "{name}: placement {result}",
			artistLine: "Artist {result}",
			titleLine: "Title {result}",
			yearLine: "Year {result}",
			cardStaysTeam: "The card stays on the team timeline.",
			cardDiscardedTeam: "The card is discarded and the team loses a token.",
			wonByName: "{name} wins the card.",
			nobodyWins: "Nobody wins the card.",
			stealWonCard: "won the card",
			stealCorrectTooLate: "correct, but too late",
			stealMissed: "missed",
			stealByLine: "Steal by {name}: {result} (−1 token)",
		},
	},
	hostView: {
		shareCode: "Share code",
		needPlayers: "At least two players are needed (one for Cooperative).",
		hideTrack: "Hide the track",
		kicker: "Music Timeline · host",
		roomHeading: "{label} room",
		packSummaryWithTracks:
			"{packTitle} pack · first to {target} cards · {count} tracks left",
		packSummaryNoTracks: "{packTitle} pack · first to {target} cards",
		lobbyInstructionsShared:
			"Share the join code. Everyone who joins before the start plays on one shared team timeline.",
		lobbyInstructionsSolo:
			"Share the join code. Everyone who joins before the start plays.",
		startGame: "Start game",
		djPanelKicker: "DJ panel · keep this away from players",
		revealTrackSummary: "Reveal mystery track for playback",
		findOnSpotify: "Find on Spotify",
		placementLocked: "Placement locked",
		waitingForPlacement: "Waiting for the placement",
		stealClaims: { one: "{count} steal claim", other: "{count} steal claims" },
		revealYear: "Reveal year",
		nextRound: "Next round",
		actionFailed: "Action failed",
	},
	setupForm: {
		packTracks: { one: "{count} track", other: "{count} tracks" },
		timerSecondsShort: "{count}s",
		playbackNote:
			"You play each song yourself, for example on Spotify. The app shows you which one; it does not stream audio.",
		joinInstead: "Have a code? Join a room",
		gameModeLabel: "Game mode",
		songPackLabel: "Song pack",
		packOption: {
			one: "{packTitle} ({count} track)",
			other: "{packTitle} ({count} tracks)",
		},
		cardsToWinLabel: "Cards to win",
		cardsOption: "{count} cards",
		turnTimerLabel: "Turn timer",
		noTimer: "No timer",
		timerSecondsOption: "{count} seconds",
		playableTracksInfo: {
			one: "{count} playable track with host-device playback. The host plays each mystery track on their own speaker (for example via Spotify) — this prototype does not stream audio itself.",
			other:
				"{count} playable tracks with host-device playback. The host plays each mystery track on their own speaker (for example via Spotify) — this prototype does not stream audio itself.",
		},
		createRoomError: "Could not create the room",
		creatingRoom: "Creating room...",
		createRoom: "Create music room",
	},
	stage: {
		hostStillSettingUp: "The host is still setting up the game.",
		statusWaitingForHost: "Waiting for the host to start",
		statusNowPlaying: "Round {round} · {name}'s turn",
		statusRevealed: "Round {round} revealed",
		statusGameOver: "Game over",
		remainingSeconds: "{count}s",
		howItWorksHeading: "How {mode} works",
		yourTurnHeading: "Your turn · place the mystery song",
		placementLocked: "Placement locked",
		waitingForHostReveal: "Waiting for the host to reveal the year.",
		nowPlayingHeading: "Now playing · answers hidden",
		activePlacingSongLocked: "{name} is placing the song. Placement locked.",
		activePlacingSongListen: "{name} is placing the song. Listen along.",
		stealClaimLocked: "Steal claim locked. The reveal decides.",
		stealButton: "Think they're wrong? Steal for 1 token",
		stealFormHeading: "Steal: place it on your own timeline",
		noTokensToSteal: "No tokens left to steal with.",
		waitingForNextRound: "Waiting for the host to start the next round.",
		coopWon: "Timeline complete — the team wins",
		coopLost: "Out of tokens — the timeline wins",
		teamTimelineHeading: {
			one: "Team timeline · {count} card",
			other: "Team timeline · {count} cards",
		},
		yourTimelineHeading: {
			one: "Your timeline · {count} card",
			other: "Your timeline · {count} cards",
		},
		placementInstructions:
			"Pick the spot where the mystery song belongs. The oldest song comes first.",
		artistLabelRequired: "Artist (required to win)",
		artistLabelBonus: "Artist (bonus token)",
		titleLabelRequired: "Title (required to win)",
		titleLabelBonus: "Title (bonus token)",
		artistPlaceholder: "Who plays it?",
		titlePlaceholder: "What is it called?",
		exactYearLabel: "Exact year (required to win)",
		yearPlaceholder: "e.g. 1987",
		submitError: "Could not submit",
		stealSubmit: "Spend 1 token · lock steal",
		lockPlacement: "Lock placement",
	},
	newGame: {
		heading: "Host a music timeline room",
		intro:
			"Pick a mode and a song pack, invite players with a code, and place mystery songs in the right spot of the timeline.",
	},
	session: {
		roomTitle: "Music room",
		loadingRoom: "Loading room...",
		roomNotFound: "Room not found.",
		hostSessionExpired: "Host session expired. Create a new room.",
		loadingGame: "Loading game...",
		gameNotFound: "Game not found.",
		joinFirst: "Join this room with its code first.",
	},
};

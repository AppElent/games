import type { squadSurge as enSquadSurge } from "../../en/games/squadSurge";

export const squadSurge = {
	start: {
		heading: "Laat je leger groeien, breek door de linie",
		description:
			"Je squad vuurt automatisch — stuur door de beste poort, grijp wapenkratten, maai de horde neer en schiet de eindbaas aan het einde van de weg neer.",
		bestDistanceLabel: "Beste afstand:",
		clearedLabel: "Gehaald:",
		clearedLevel: "Level {level}",
		difficultyKicker: "Moeilijkheidsgraad",
		deployButton: "Squad inzetten",
		controlsHint:
			"Sleep of gebruik ←/→ om te sturen. Voeg deze pagina op iPhone/iPad toe aan je beginscherm voor volledig scherm spelen.",
		difficulties: {
			recruit: "Rekruut",
			regular: "Regulier",
			veteran: "Veteraan",
			elite: "Elite",
			legend: "Legende",
		},
	},
	play: {
		hitASnag: "Squad Surge liep vast",
		muteSound: "Geluid dempen",
		unmuteSound: "Geluid aanzetten",
		victoryKicker: "Overwinning",
		defeatKicker: "Nederlaag",
		wonHeading: "De linie is doorbroken!",
		lostHeading: "Je squad is gesneuveld",
		wonBody: "Je {army} soldaten hebben de eindbaas neergeschoten.",
		bossReachedBody:
			"De eindbaas bereikte je linie voordat je hem kon verslaan.",
		hordeWipedBody: "De horde heeft je squad uitgeroeid.",
		distanceLabel: "Afstand: {distance}m",
		bestSuffix: " · Beste: {best}m",
		changeDifficultyButton: "Moeilijkheidsgraad wijzigen",
	},
	hud: {
		weapons: {
			pistol: "Pistool",
			smg: "SMG",
			shotgun: "Shotgun",
			minigun: "Minigun",
		},
		bossArrived: "BOSS!",
		bossHudLabel: "BOSS",
	},
} satisfies typeof enSquadSurge;

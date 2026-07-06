import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/about")({
	component: About,
});

function About() {
	return (
		<main className="club-wrap py-10">
			<p className="club-kicker mb-2">About</p>
			<h1 className="club-title mb-4 text-4xl font-bold text-[var(--club-text)] sm:text-5xl">
				Arcade Club
			</h1>
			<div className="club-panel max-w-3xl rounded-2xl p-6 sm:p-8">
				<p className="text-base leading-8 text-[var(--club-muted)]">
					Arcade Club is a shelf of party and board games you can start in
					seconds and play together from anywhere. Host a live quiz night, send
					a friend a backgammon or chess challenge, race through a solo Sudoku,
					or gather a room for Signal Words and Bluff Dice.
				</p>
				<p className="mt-4 text-base leading-8 text-[var(--club-muted)]">
					Everything runs right in the browser — no installs. Create a room code
					or a share link and players join instantly on their own device, signed
					in or as a guest.
				</p>
			</div>
		</main>
	);
}

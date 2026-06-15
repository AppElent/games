import { ParticipantList } from "#/components/games/ParticipantList";
import { QrSharePanel } from "#/components/games/QrSharePanel";
import { SeatBanner } from "#/components/games/SeatBanner";

type Bundle = {
	session: { title: string; shareToken?: string };
	participants: Array<{
		_id: string;
		displayName: string;
		role: "host" | "player" | "watcher";
		seat?: string;
		connected: boolean;
	}>;
	state: {
		phase: "waiting" | "ready" | "active" | "finished";
		whiteParticipantId?: string;
		blackParticipantId?: string;
		moveLog: string[];
	} | null;
};

const BOARD_STRIPS = ["one", "two", "three", "four", "five", "six"];

export function BackgammonWaitingRoom({
	bundle,
	shareUrl,
}: {
	bundle: Bundle;
	shareUrl: string;
}) {
	const opponentJoined = Boolean(bundle.state?.blackParticipantId);
	const white = bundle.participants.find(
		(participant) => participant._id === bundle.state?.whiteParticipantId,
	);
	const black = bundle.participants.find(
		(participant) => participant._id === bundle.state?.blackParticipantId,
	);

	return (
		<div className="grid gap-5 lg:grid-cols-[1fr_320px]">
			<section className="club-panel rounded-lg p-6">
				<p className="club-kicker mb-2">Backgammon</p>
				<h1 className="club-title mb-4 text-3xl font-bold text-white">
					{opponentJoined ? "Opponent joined" : "Waiting for opponent"}
				</h1>
				<SeatBanner
					tone={opponentJoined ? "success" : "warning"}
					label={
						opponentJoined
							? "Both seats are claimed. Board rules come next."
							: "Share the link with one opponent to claim the second seat."
					}
				/>

				<div className="mt-6 grid gap-4 md:grid-cols-[1fr_1fr]">
					<SeatCard label="White" name={white?.displayName ?? "Host"} />
					<SeatCard
						label="Black"
						name={black?.displayName ?? "Open seat"}
						open={!black}
					/>
				</div>

				<div className="mt-6 aspect-[1.25] rounded-lg border border-white/10 bg-[linear-gradient(135deg,#111827,#1f2937)] p-4">
					<div className="grid h-full grid-cols-2 gap-3">
						<div className="grid grid-rows-6 gap-2 rounded-md bg-orange-300/10 p-3">
							{BOARD_STRIPS.map((strip) => (
								<div
									key={`left-${strip}`}
									className="rounded-sm bg-orange-200/30"
								/>
							))}
						</div>
						<div className="grid grid-rows-6 gap-2 rounded-md bg-cyan-300/10 p-3">
							{BOARD_STRIPS.map((strip) => (
								<div
									key={`right-${strip}`}
									className="rounded-sm bg-cyan-200/30"
								/>
							))}
						</div>
					</div>
				</div>
			</section>
			<aside className="space-y-4">
				<QrSharePanel label="Challenge link" url={shareUrl} />
				<ParticipantList participants={bundle.participants} />
			</aside>
		</div>
	);
}

function SeatCard({
	label,
	name,
	open = false,
}: {
	label: string;
	name: string;
	open?: boolean;
}) {
	return (
		<div
			className={`rounded-lg border p-4 ${
				open
					? "border-dashed border-orange-300/40 bg-orange-300/10"
					: "border-white/10 bg-white/5"
			}`}
		>
			<p className="text-xs font-bold uppercase tracking-wide text-slate-400">
				{label}
			</p>
			<p className="mt-1 text-lg font-bold text-white">{name}</p>
		</div>
	);
}

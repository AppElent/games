import { createFileRoute } from "@tanstack/react-router";
import { useMutation } from "convex/react";
import { useState } from "react";
import { CHESS_TIME_CONTROLS, type ChessTimeControl } from "#/lib/games/chess";
import { getUserErrorMessage } from "#/lib/games/errors";
import { getOrCreateGuestIdentity } from "#/lib/games/sessions";
import { api } from "../../../convex/_generated/api";

export const Route = createFileRoute("/chess/new")({
	component: ChessNewPage,
});

type HostColor = "white" | "black" | "random";

function ChessNewPage() {
	const createSession = useMutation(api.sessions.create);
	const createState = useMutation(api.chess.createState);
	const [timeControl, setTimeControl] = useState<ChessTimeControl>("untimed");
	const [hostColor, setHostColor] = useState<HostColor>("random");
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState("");

	async function handleCreate() {
		setBusy(true);
		setError("");
		try {
			const guest = getOrCreateGuestIdentity();
			const result = await createSession({
				gameType: "chess",
				joinMode: "challenge",
				authPolicy: "guestAllowed",
				title: "Chess Match",
				displayName: guest.displayName,
				guestId: guest.id,
			});
			await createState({
				sessionId: result.sessionId,
				hostParticipantId: result.participantId,
				timeControl,
				hostColor,
			});
			window.sessionStorage.setItem(
				"arcade-club.participantId",
				result.participantId,
			);
			window.location.href = `/chess/${result.sessionId}`;
		} catch (caught) {
			setError(getUserErrorMessage(caught, "Could not create challenge"));
			setBusy(false);
		}
	}

	return (
		<main className="club-wrap py-10">
			<p className="club-kicker mb-2">Chess</p>
			<h1 className="club-title mb-4 text-4xl font-bold text-white">
				Start a match
			</h1>
			{error ? <p className="mb-4 text-sm text-orange-200">{error}</p> : null}
			<div className="club-panel max-w-xl rounded-lg p-6">
				<fieldset className="mb-5">
					<legend className="mb-2 text-sm font-bold uppercase tracking-wide text-slate-400">
						Time control
					</legend>
					<div className="flex flex-wrap gap-2">
						{(Object.keys(CHESS_TIME_CONTROLS) as ChessTimeControl[]).map(
							(control) => (
								<button
									key={control}
									type="button"
									aria-pressed={timeControl === control}
									onClick={() => setTimeControl(control)}
									className={`min-h-11 rounded-md px-4 py-2 font-bold ${
										timeControl === control
											? "bg-white text-slate-950"
											: "border border-white/20 bg-white/10 text-white"
									}`}
								>
									{CHESS_TIME_CONTROLS[control].label}
								</button>
							),
						)}
					</div>
				</fieldset>
				<fieldset className="mb-6">
					<legend className="mb-2 text-sm font-bold uppercase tracking-wide text-slate-400">
						Your color
					</legend>
					<div className="flex flex-wrap gap-2">
						{(["random", "white", "black"] as const).map((color) => (
							<button
								key={color}
								type="button"
								aria-pressed={hostColor === color}
								onClick={() => setHostColor(color)}
								className={`min-h-11 rounded-md px-4 py-2 font-bold capitalize ${
									hostColor === color
										? "bg-white text-slate-950"
										: "border border-white/20 bg-white/10 text-white"
								}`}
							>
								{color}
							</button>
						))}
					</div>
				</fieldset>
				<button
					type="button"
					disabled={busy}
					onClick={handleCreate}
					className="min-h-11 w-full rounded-md bg-white px-5 py-3 font-bold text-slate-950 disabled:cursor-not-allowed disabled:opacity-60"
				>
					{busy ? "Creating challenge..." : "Create challenge link"}
				</button>
				<p className="mt-3 text-sm text-slate-400">
					Share the link or QR code — your opponent claims the open seat
					automatically.
				</p>
			</div>
		</main>
	);
}

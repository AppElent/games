import { formatJoinCode } from "@arcadeclub/core/sessions";
import { useMessages } from "#/lib/i18n";

const TONES = {
	quiz: {
		box: "rounded-md border border-cyan-300/30 bg-cyan-300/10 px-4 py-3 text-right",
		label: "block text-xs font-bold uppercase tracking-wide text-cyan-100",
		code: "club-title text-3xl font-bold text-white",
	},
	hitster: {
		box: "rounded-2xl border border-[var(--club-line)] bg-[var(--club-panel)] px-4 py-3 text-right",
		label:
			"block text-xs font-bold uppercase tracking-wide text-[var(--club-soft)]",
		code: "text-3xl font-bold tabular-nums tracking-tight text-[var(--club-text)]",
	},
} as const;

/** A room's join code on the host's screen, for players to type in. */
export function JoinCodePanel({
	joinCode,
	tone,
}: {
	joinCode?: string;
	tone: keyof typeof TONES;
}) {
	const messages = useMessages();
	const classNames = TONES[tone];
	return (
		<div className={classNames.box}>
			<span className={classNames.label}>
				{messages.common.session.joinCode}
			</span>
			<span className={classNames.code}>
				{joinCode ? formatJoinCode(joinCode) : "------"}
			</span>
		</div>
	);
}

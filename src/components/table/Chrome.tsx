import type { FeltColor } from "@arcadeclub/core/cards/engine";
import { Link } from "@tanstack/react-router";
import { X } from "lucide-react";
import { type ReactNode, useEffect, useRef } from "react";
import { FullscreenGameShell } from "#/components/games/FullscreenGameShell";
import { useMessages } from "#/lib/i18n";
// The felt, panels, buttons and sheets every table game wears.
import "../cards/cards.css";

export type TableCrumb = {
	label: string;
	to?: "/cards" | "/cards/$gameId" | "/dice" | "/dice/$gameId";
	params?: { gameId: string };
};

/** The trail back up to a game club; the last step is the page you're on. */
export function TableCrumbs({
	items,
	label,
}: {
	items: TableCrumb[];
	label: string;
}) {
	return (
		<nav className="cards-crumbs" aria-label={label}>
			<ol>
				{items.map((item) => (
					<li key={item.label}>
						{item.to ? (
							<Link to={item.to} params={item.params}>
								{item.label}
							</Link>
						) : (
							<span aria-current="page">{item.label}</span>
						)}
					</li>
				))}
			</ol>
		</nav>
	);
}

/** Felt-covered page for the screens around a table game: hub, setup, lobby. */
export function TablePage({
	title,
	felt,
	crumbs,
	crumbsLabel,
	decor,
	children,
}: {
	title: string;
	felt: FeltColor;
	crumbs: TableCrumb[];
	crumbsLabel: string;
	/** Hidden assets the page's children draw from, such as a sprite sheet. */
	decor?: ReactNode;
	children: ReactNode;
}) {
	return (
		<FullscreenGameShell title={title}>
			<div className="cards-felt" data-felt={felt}>
				{decor}
				<div className="cards-page">
					<div className="pt-3 pr-3">
						<TableCrumbs items={crumbs} label={crumbsLabel} />
					</div>
					<div className="cards-page-inner">{children}</div>
				</div>
			</div>
		</FullscreenGameShell>
	);
}

/** A panel saying what could not be found, with the way back to the club. */
export function TableNotFound({
	heading,
	back,
}: {
	heading: string;
	back: { to: "/cards" | "/dice"; label: string };
}) {
	return (
		<div className="cards-panel mt-10 p-6 text-center">
			<h1 className="cards-title mb-3 text-2xl">{heading}</h1>
			<Link to={back.to} className="btn-gold">
				{back.label}
			</Link>
		</div>
	);
}

/**
 * A native modal dialog, shown as a bottom sheet on phones. Native gives us the
 * focus trap, Escape, and focus returning to whatever opened it.
 */
export function Sheet({
	open,
	title,
	onClose,
	dismissable = true,
	children,
}: {
	open: boolean;
	title: string;
	onClose: () => void;
	dismissable?: boolean;
	children: ReactNode;
}) {
	const ref = useRef<HTMLDialogElement>(null);
	const closeLabel = useMessages().common.actions.close;

	useEffect(() => {
		const dialog = ref.current;
		if (!dialog) {
			return;
		}
		if (open && !dialog.open) {
			dialog.showModal();
		} else if (!open && dialog.open) {
			dialog.close();
		}
	}, [open]);

	return (
		<dialog
			ref={ref}
			className="sheet"
			aria-label={title}
			onCancel={(event) => {
				if (!dismissable) {
					event.preventDefault();
				}
			}}
			onClose={() => {
				// Browsers can close a dialog despite the cancelled event above.
				if (open && !dismissable) {
					ref.current?.showModal();
				} else {
					onClose();
				}
			}}
		>
			{open ? (
				<>
					<div className="sheet-head">
						<h2 className="cards-title min-w-0 flex-1 text-lg">{title}</h2>
						{dismissable ? (
							<button
								type="button"
								aria-label={closeLabel}
								onClick={onClose}
								className="stepper-btn"
							>
								<X className="h-5 w-5" />
							</button>
						) : null}
					</div>
					<div className="sheet-body">{children}</div>
				</>
			) : null}
		</dialog>
	);
}

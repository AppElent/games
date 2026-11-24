import { cn } from "#/lib/auth/lib/utils";
import { useMessages } from "#/lib/i18n";

export function AuthButton({
	children,
	loading,
	busyLabel,
	disabled,
	variant = "primary",
	type = "submit",
	onClick,
	className,
}: {
	children: React.ReactNode;
	loading?: boolean;
	/** Shown in place of `children` while `loading`; "Please wait…" by default. */
	busyLabel?: string;
	disabled?: boolean;
	variant?: "primary" | "secondary" | "ghost";
	type?: "submit" | "button";
	onClick?: () => void;
	className?: string;
}) {
	const wait = useMessages().auth.signIn.busy;
	return (
		<button
			type={type}
			disabled={loading || disabled}
			aria-busy={loading ?? false}
			onClick={onClick}
			className={cn(
				"inline-flex items-center justify-center rounded-[var(--auth-radius)] px-4 py-2 text-sm font-medium transition disabled:opacity-60",
				variant === "primary"
					? "bg-[var(--auth-accent)] text-[var(--auth-accent-fg)] hover:opacity-90"
					: variant === "secondary"
						? "border border-[var(--auth-border)] text-[var(--auth-fg)] hover:bg-[var(--auth-hover-bg)]"
						: "border border-dashed border-[var(--auth-accent)] text-[var(--auth-fg)] hover:bg-[var(--auth-hover-bg)]",
				className,
			)}
		>
			{loading ? (busyLabel ?? wait) : children}
		</button>
	);
}

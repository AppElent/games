import { cn } from "#/lib/auth/lib/utils";

export function AuthError({
	message,
	id,
	className,
}: {
	message: string | null;
	id?: string;
	className?: string;
}) {
	if (!message) {
		return null;
	}
	return (
		<p
			id={id}
			role="alert"
			className={cn(
				"rounded-[var(--auth-radius)] bg-[var(--auth-error)]/10 px-3 py-2 text-sm text-[var(--auth-error)]",
				className,
			)}
		>
			{message}
		</p>
	);
}

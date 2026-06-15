export function SessionShell({
	title,
	aside,
	children,
}: {
	title: string;
	aside?: React.ReactNode;
	children: React.ReactNode;
}) {
	return (
		<main className="club-wrap grid gap-5 py-6 lg:grid-cols-[1fr_320px]">
			<section>
				<h1 className="club-title mb-5 text-3xl font-bold text-white">
					{title}
				</h1>
				{children}
			</section>
			{aside ? <aside className="space-y-4">{aside}</aside> : null}
		</main>
	);
}

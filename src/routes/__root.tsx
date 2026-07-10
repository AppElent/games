import { THEME_INIT_SCRIPT, ThemeSync } from "@appelent/auth";
import { TanStackDevtools } from "@tanstack/react-devtools";
import type { QueryClient } from "@tanstack/react-query";
import {
	createRootRouteWithContext,
	HeadContent,
	Scripts,
	useRouterState,
} from "@tanstack/react-router";
import { TanStackRouterDevtoolsPanel } from "@tanstack/react-router-devtools";
import "#/lib/router-static-data";
import { type Locale, LocaleProvider, readClientLocale } from "#/lib/i18n";
import { LanguageSync } from "#/lib/i18n/LanguageSync";
import { getSsrLocale } from "#/lib/i18n/server";
import Footer from "../components/Footer";
import Header from "../components/Header";
import ClerkProvider from "../integrations/clerk/provider";
import ConvexProvider from "../integrations/convex/provider";
import TanStackQueryDevtools from "../integrations/tanstack-query/devtools";
import appCss from "../styles.css?url";

interface MyRouterContext {
	queryClient: QueryClient;
}

export const Route = createRootRouteWithContext<MyRouterContext>()({
	head: () => ({
		meta: [
			{
				charSet: "utf-8",
			},
			{
				name: "viewport",
				content: "width=device-width, initial-scale=1, viewport-fit=cover",
			},
			{
				name: "apple-mobile-web-app-capable",
				content: "yes",
			},
			{
				name: "apple-mobile-web-app-status-bar-style",
				content: "black-translucent",
			},
			{
				name: "mobile-web-app-capable",
				content: "yes",
			},
			{
				title: "Arcade Club",
			},
		],
		links: [
			{
				rel: "stylesheet",
				href: appCss,
			},
		],
	}),
	loader: async (): Promise<{ locale: Locale }> => {
		if (typeof document !== "undefined") {
			return { locale: readClientLocale() };
		}
		const { locale } = await getSsrLocale();
		return { locale: locale as Locale };
	},
	shellComponent: RootDocument,
});

function RootDocument({ children }: { children: React.ReactNode }) {
	const { locale } = Route.useLoaderData();
	const isFullscreen = useRouterState({
		select: (s) => s.matches.some((m) => m.staticData.fullscreen === true),
	});
	return (
		<html lang={locale} suppressHydrationWarning>
			<head>
				<HeadContent />
				{/* biome-ignore lint/security/noDangerouslySetInnerHtml: static pre-paint script, no user input */}
				<script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
			</head>
			<body className="font-sans antialiased [overflow-wrap:anywhere] selection:bg-cyan-300/30">
				<LocaleProvider initialLocale={locale}>
					<ClerkProvider>
						<ConvexProvider>
							<ThemeSync />
							<LanguageSync />
							{!isFullscreen && <Header />}
							{children}
							{!isFullscreen && <Footer />}
							<TanStackDevtools
								config={{
									position: "bottom-right",
								}}
								plugins={[
									{
										name: "Tanstack Router",
										render: <TanStackRouterDevtoolsPanel />,
									},
									TanStackQueryDevtools,
								]}
							/>
						</ConvexProvider>
					</ClerkProvider>
				</LocaleProvider>
				<Scripts />
			</body>
		</html>
	);
}

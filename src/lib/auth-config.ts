import type { AuthConfig } from "#/lib/auth";

export const authConfig: AuthConfig = {
	appName: "Arcade Club",
	paths: {
		signIn: "/sign-in",
		signUp: "/sign-up",
		forgotPassword: "/forgot-password",
		afterAuth: "/dashboard",
		account: "/account",
	},
	features: {
		forgotPassword: true,
	},
	socialProviders: [],
};

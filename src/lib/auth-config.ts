import type { AuthConfig } from "@appelent/auth";

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

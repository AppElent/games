import { httpRouter } from "convex/server";
import { internal } from "./_generated/api";
import { httpAction } from "./_generated/server";
import { readEvent, signingKey, verifyDelivery } from "./lib/clerkWebhook";

const http = httpRouter();

/**
 * Clerk's webhook for the shared AppElent login. When a Clerk user is deleted
 * (from any AppElent app or the Clerk dashboard), Arcade Club purges that
 * account's data with the same code as "Delete Arcade Club data only". The
 * endpoint's Svix signing secret is `CLERK_WEBHOOK_SECRET`; an unsigned or
 * badly signed request changes nothing. Other event types are acknowledged
 * and ignored, so Clerk stops retrying them.
 */
http.route({
	path: "/clerk/webhook",
	method: "POST",
	handler: httpAction(async (ctx, request) => {
		const secret = process.env.CLERK_WEBHOOK_SECRET;
		if (!secret) {
			console.error("CLERK_WEBHOOK_SECRET is not set; rejecting the webhook");
			return new Response("Webhook not configured", { status: 500 });
		}
		const verdict = await verifyDelivery(
			request.headers,
			await request.text(),
			await signingKey(secret),
			Date.now(),
		);
		if (!verdict.ok) {
			return new Response(verdict.reason, { status: verdict.status });
		}
		const event = readEvent(verdict.payload);
		if (event.kind === "malformed") {
			return new Response("Unexpected event", { status: 400 });
		}
		if (event.kind === "userDeleted") {
			await ctx.runMutation(internal.account.purgeDeletedUser, {
				userId: event.userId,
			});
		}
		return new Response(null, { status: 200 });
	}),
});

export default http;

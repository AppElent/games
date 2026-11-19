import { createHmac, randomBytes } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "./_generated/api";
import type { TableNames } from "./_generated/dataModel";
import { signingKey, verifyDelivery } from "./lib/clerkWebhook";
import schema from "./schema";
import {
	advance,
	freezeClock,
	HOST_USER,
	hostSession,
	joinWithCode,
	setup,
	type T,
	T0,
} from "./test.helpers";

freezeClock();

const SECRET_BYTES = randomBytes(32);
const SECRET = `whsec_${SECRET_BYTES.toString("base64")}`;
const OTHER_USER = "user_other";

/** Headers Svix would send for `body`, signed with `key` at `seconds`. */
function signed(
	body: string,
	{
		key = SECRET_BYTES,
		id = `msg_${randomBytes(8).toString("hex")}`,
		seconds = Math.floor(Date.now() / 1000),
	} = {},
) {
	const signature = createHmac("sha256", key)
		.update(`${id}.${seconds}.${body}`)
		.digest("base64");
	return {
		"content-type": "application/json",
		"svix-id": id,
		"svix-timestamp": String(seconds),
		"svix-signature": `v1,${signature}`,
	};
}

function userDeleted(userId: string) {
	return JSON.stringify({
		type: "user.deleted",
		object: "event",
		data: { id: userId, deleted: true, object: "user" },
	});
}

function post(t: T, body: string, headers: Record<string, string>) {
	return t.fetch("/clerk/webhook", { method: "POST", body, headers });
}

/** Every row of every table, in insertion order. */
async function snapshot(t: T) {
	return await t.run(async (ctx) => {
		const rows: Record<string, unknown[]> = {};
		for (const table of Object.keys(schema.tables) as TableNames[]) {
			// Join codes are random per run; blank them so two runs compare.
			rows[table] = (await ctx.db.query(table).collect()).map((row) =>
				"joinCode" in row ? { ...row, joinCode: "" } : row,
			);
		}
		return rows;
	});
}

/**
 * The host's own content, a solo game and a finished game with a guest;
 * plus another account's draft.
 */
async function seed(t: T) {
	vi.setSystemTime(T0);
	await t
		.withIdentity({ subject: HOST_USER })
		.mutation(api.workbench.createDraft, {
			kind: "quiz-set",
			title: "Mine",
			payload: "{}",
		});
	await t
		.withIdentity({ subject: OTHER_USER })
		.mutation(api.workbench.createDraft, {
			kind: "quiz-set",
			title: "Theirs",
			payload: "{}",
		});
	await hostSession(t, "live-quiz", "solo");
	const room = await hostSession(t, "live-quiz", "room");
	await joinWithCode(t, room.joinCode as string, "guest_a");
	advance(60 * 60_000);
}

async function deleteInApp(t: T) {
	const user = t.withIdentity({ subject: HOST_USER });
	let done = false;
	while (!done) {
		({ done } = await user.mutation(api.account.deleteMyData, {
			expectedSubject: HOST_USER,
		}));
	}
}

describe("POST /clerk/webhook", () => {
	beforeEach(() => {
		process.env.CLERK_WEBHOOK_SECRET = SECRET;
	});
	afterEach(() => {
		delete process.env.CLERK_WEBHOOK_SECRET;
	});

	it("purges a deleted Clerk user exactly as deleting Arcade Club's data in the app does", async () => {
		const inApp = setup();
		await seed(inApp);
		await deleteInApp(inApp);

		const webhook = setup();
		await seed(webhook);
		const body = userDeleted(HOST_USER);
		const response = await post(webhook, body, signed(body));
		expect(response.status).toBe(200);
		await webhook.finishAllScheduledFunctions(vi.runAllTimers);

		expect(await snapshot(webhook)).toEqual(await snapshot(inApp));
		const drafts = (await snapshot(webhook)).contentDrafts as {
			ownerUserId: string;
		}[];
		expect(drafts.map((row) => row.ownerUserId)).toEqual([OTHER_USER]);
	});

	it("purges a large account across scheduled batches", async () => {
		const t = setup();
		await t.run(async (ctx) => {
			for (let index = 0; index < 520; index += 1) {
				await ctx.db.insert("contentDrafts", {
					ownerUserId: HOST_USER,
					gameType: "live-quiz",
					kind: "quiz-set",
					title: `Draft ${index}`,
					payload: "{}",
					status: "draft",
					validationErrors: [],
				});
			}
		});
		const body = userDeleted(HOST_USER);
		expect((await post(t, body, signed(body))).status).toBe(200);
		expect((await snapshot(t)).contentDrafts.length).toBeGreaterThan(0);
		await t.finishAllScheduledFunctions(vi.runAllTimers);
		expect((await snapshot(t)).contentDrafts).toEqual([]);
	});

	it("is a no-op on a second delivery and for a user with no data", async () => {
		const t = setup();
		await seed(t);
		const body = userDeleted(HOST_USER);
		const headers = signed(body);
		expect((await post(t, body, headers)).status).toBe(200);
		await t.finishAllScheduledFunctions(vi.runAllTimers);
		const after = await snapshot(t);

		expect((await post(t, body, headers)).status).toBe(200);
		const stranger = userDeleted("user_never_played");
		expect((await post(t, stranger, signed(stranger))).status).toBe(200);
		await t.finishAllScheduledFunctions(vi.runAllTimers);
		expect(await snapshot(t)).toEqual(after);
	});

	it("acknowledges other event types and changes nothing", async () => {
		const t = setup();
		await seed(t);
		const before = await snapshot(t);
		const body = JSON.stringify({
			type: "user.updated",
			data: { id: HOST_USER },
		});
		expect((await post(t, body, signed(body))).status).toBe(200);
		expect(await snapshot(t)).toEqual(before);
	});

	it.each([
		["missing signature headers", () => ({}), 400],
		[
			"a signature from another secret",
			(body: string) => signed(body, { key: randomBytes(32) }),
			401,
		],
		["a tampered body", () => signed(userDeleted(OTHER_USER)), 401],
		[
			"a replayed delivery older than five minutes",
			(body: string) =>
				signed(body, { seconds: Math.floor(Date.now() / 1000) - 6 * 60 }),
			401,
		],
		[
			"an unsupported signature version",
			(body: string) => ({
				...signed(body),
				"svix-signature": signed(body)["svix-signature"].replace("v1,", "v2,"),
			}),
			401,
		],
	])("rejects %s with no side effects", async (_, headers, status) => {
		const t = setup();
		await seed(t);
		const before = await snapshot(t);
		const body = userDeleted(HOST_USER);
		const response = await post(t, body, headers(body));
		expect(response.status).toBe(status);
		await t.finishAllScheduledFunctions(vi.runAllTimers);
		expect(await snapshot(t)).toEqual(before);
	});

	it("rejects every delivery while the secret is not configured", async () => {
		delete process.env.CLERK_WEBHOOK_SECRET;
		const t = setup();
		await seed(t);
		const before = await snapshot(t);
		const body = userDeleted(HOST_USER);
		expect((await post(t, body, signed(body))).status).toBe(500);
		expect(await snapshot(t)).toEqual(before);
	});

	it("rejects a signed user.deleted without a user id", async () => {
		const t = setup();
		const body = JSON.stringify({ type: "user.deleted", data: {} });
		expect((await post(t, body, signed(body))).status).toBe(400);
	});
});

describe("verifyDelivery", () => {
	// Svix's published example: https://docs.svix.com/receiving/verifying-payloads/how-manual
	const vector = {
		secret: "whsec_MfKQ9r8GKYqrTwjUPD8ILPZIo2LaLaSw",
		id: "msg_p5jXN8AQM9LWM0D4loKWxJek",
		timestamp: "1614265330",
		body: '{"test": 2432232314}',
		signature: "v1,g0hM9SsE+OTPJTGt/tmIKtSyZlE3uFJELVlNIOLJ1OE=",
	};

	function headers(signature: string) {
		return new Headers({
			"svix-id": vector.id,
			"svix-timestamp": vector.timestamp,
			"svix-signature": signature,
		});
	}

	it("accepts Svix's example among several signatures", async () => {
		const key = await signingKey(vector.secret);
		const verdict = await verifyDelivery(
			headers(`v1,bm90IGl0 ${vector.signature}`),
			vector.body,
			key,
			Number(vector.timestamp) * 1000,
		);
		expect(verdict).toEqual({ ok: true, payload: { test: 2432232314 } });
	});

	it("rejects the example once the body changes", async () => {
		const key = await signingKey(vector.secret);
		const verdict = await verifyDelivery(
			headers(vector.signature),
			'{"test": 1}',
			key,
			Number(vector.timestamp) * 1000,
		);
		expect(verdict).toMatchObject({ ok: false, status: 401 });
	});

	it("refuses a secret that is not a signing secret", async () => {
		await expect(signingKey("whsec_")).rejects.toThrow("CLERK_WEBHOOK_SECRET");
	});
});

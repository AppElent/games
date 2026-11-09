import type {
	ContentDraftKind,
	QuizSetDraft,
} from "@arcadeclub/core/content-drafts";
import {
	getDraftGameType,
	validateContentDraft,
} from "@arcadeclub/core/content-drafts";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import { mutation, query } from "./_generated/server";
import { requireOwned, requireUserId } from "./lib/auth";
import { gameError } from "./lib/errors";
import { contentDraftKindValidator } from "./schema";

/** What a draft's rows store and its editor shows, one line per problem. */
function draftErrors(kind: ContentDraftKind, payload: string) {
	return validateContentDraft(kind, payload).map((error) =>
		error.path ? `${error.path}: ${error.message}` : error.message,
	);
}

async function requireOwnDraft(ctx: MutationCtx, draftId: Id<"contentDrafts">) {
	const ownerUserId = await requireUserId(ctx);
	const draft = requireOwned(
		await ctx.db.get(draftId),
		ownerUserId,
		"draftNotFound",
	);
	return { ownerUserId, draft };
}

export const createDraft = mutation({
	args: {
		kind: contentDraftKindValidator,
		title: v.string(),
		payload: v.string(),
	},
	handler: async (ctx, args) => {
		const ownerUserId = await requireUserId(ctx);
		const validationErrors = draftErrors(args.kind, args.payload);
		return await ctx.db.insert("contentDrafts", {
			ownerUserId,
			gameType: getDraftGameType(args.kind),
			kind: args.kind,
			title: args.title.trim() || "Untitled draft",
			payload: args.payload,
			status: "draft",
			validationErrors,
		});
	},
});

export const updateDraft = mutation({
	args: {
		draftId: v.id("contentDrafts"),
		title: v.optional(v.string()),
		payload: v.string(),
	},
	handler: async (ctx, args) => {
		const { draft } = await requireOwnDraft(ctx, args.draftId);
		const validationErrors = draftErrors(draft.kind, args.payload);
		await ctx.db.patch(args.draftId, {
			payload: args.payload,
			title: args.title?.trim() || draft.title,
			// Editing an approved/rejected draft sends it back to review.
			status: "draft",
			validationErrors,
			reviewedAt: undefined,
		});
		return validationErrors;
	},
});

export const approveDraft = mutation({
	args: { draftId: v.id("contentDrafts") },
	handler: async (ctx, args) => {
		const { ownerUserId, draft } = await requireOwnDraft(ctx, args.draftId);
		// Re-validate at approval time so stale rows can never slip through.
		const validationErrors = draftErrors(draft.kind, draft.payload);
		if (validationErrors.length > 0) {
			await ctx.db.patch(args.draftId, { validationErrors });
			throw gameError("draftInvalid");
		}
		await ctx.db.patch(args.draftId, {
			status: "approved",
			validationErrors: [],
			reviewedAt: Date.now(),
		});

		// Approved quiz sets become playable immediately.
		if (draft.kind === "quiz-set") {
			const payload = JSON.parse(draft.payload) as QuizSetDraft;
			const quizSetId = await ctx.db.insert("quizSets", {
				ownerUserId,
				title: payload.title,
				description: payload.description,
				questions: payload.questions,
				isSample: false,
			});
			return { quizSetId };
		}
		return {};
	},
});

export const rejectDraft = mutation({
	args: { draftId: v.id("contentDrafts") },
	handler: async (ctx, args) => {
		await requireOwnDraft(ctx, args.draftId);
		await ctx.db.patch(args.draftId, {
			status: "rejected",
			reviewedAt: Date.now(),
		});
	},
});

export const deleteDraft = mutation({
	args: { draftId: v.id("contentDrafts") },
	handler: async (ctx, args) => {
		await requireOwnDraft(ctx, args.draftId);
		await ctx.db.delete(args.draftId);
	},
});

export const listMine = query({
	args: {},
	handler: async (ctx) => {
		const ownerUserId = await requireUserId(ctx);
		const drafts = await ctx.db
			.query("contentDrafts")
			.withIndex("by_owner", (q) => q.eq("ownerUserId", ownerUserId))
			.collect();
		return drafts.sort((a, b) => b._creationTime - a._creationTime);
	},
});

import { v } from "convex/values";
import {
	getDraftGameType,
	validateContentDraft,
} from "@arcadeclub/core/content-drafts";
import { mutation, query } from "./_generated/server";
import { requireUserId } from "./lib/auth";
import { gameError } from "./lib/errors";
import { contentDraftKindValidator } from "./schema";

export const createDraft = mutation({
	args: {
		kind: contentDraftKindValidator,
		title: v.string(),
		payload: v.string(),
	},
	handler: async (ctx, args) => {
		const ownerUserId = await requireUserId(ctx);
		const validationErrors = validateContentDraft(
			args.kind,
			args.payload,
		).map((error) => (error.path ? `${error.path}: ${error.message}` : error.message));
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
		const ownerUserId = await requireUserId(ctx);
		const draft = await ctx.db.get(args.draftId);
		if (!draft || draft.ownerUserId !== ownerUserId) {
			throw gameError("draftNotFound");
		}
		const validationErrors = validateContentDraft(
			draft.kind,
			args.payload,
		).map((error) => (error.path ? `${error.path}: ${error.message}` : error.message));
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
		const ownerUserId = await requireUserId(ctx);
		const draft = await ctx.db.get(args.draftId);
		if (!draft || draft.ownerUserId !== ownerUserId) {
			throw gameError("draftNotFound");
		}
		// Re-validate at approval time so stale rows can never slip through.
		const errors = validateContentDraft(
			draft.kind,
			draft.payload,
		);
		if (errors.length > 0) {
			await ctx.db.patch(args.draftId, {
				validationErrors: errors.map((error) =>
					error.path ? `${error.path}: ${error.message}` : error.message,
				),
			});
			throw gameError("draftInvalid");
		}
		await ctx.db.patch(args.draftId, {
			status: "approved",
			validationErrors: [],
			reviewedAt: Date.now(),
		});

		// Approved quiz sets become playable immediately.
		if (draft.kind === "quiz-set") {
			const payload = JSON.parse(draft.payload) as {
				title: string;
				description?: string;
				questions: {
					id: string;
					prompt: string;
					choices: { id: string; label: string }[];
					correctChoiceIds: string[];
					durationSeconds: number;
					points: number;
				}[];
			};
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
		const ownerUserId = await requireUserId(ctx);
		const draft = await ctx.db.get(args.draftId);
		if (!draft || draft.ownerUserId !== ownerUserId) {
			throw gameError("draftNotFound");
		}
		await ctx.db.patch(args.draftId, {
			status: "rejected",
			reviewedAt: Date.now(),
		});
	},
});

export const deleteDraft = mutation({
	args: { draftId: v.id("contentDrafts") },
	handler: async (ctx, args) => {
		const ownerUserId = await requireUserId(ctx);
		const draft = await ctx.db.get(args.draftId);
		if (!draft || draft.ownerUserId !== ownerUserId) {
			throw gameError("draftNotFound");
		}
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

/** Approved signal-words packs available for play (future game wiring). */
export const listApproved = query({
	args: { kind: contentDraftKindValidator },
	handler: async (ctx, args) => {
		const drafts = await ctx.db
			.query("contentDrafts")
			.withIndex("by_status", (q) => q.eq("status", "approved"))
			.collect();
		return drafts.filter((draft) => draft.kind === args.kind);
	},
});

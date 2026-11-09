import type { Breadcrumb, Event } from "@sentry/react";

/** Redact common credentials and identifiers even with default PII disabled. */
function sanitizeText(value: string): string {
	return value
		.replace(/Bearer\s+[^\s"']+/gi, "Bearer [Filtered]")
		.replace(/\beyJ[\w-]+\.[\w-]+\.[\w-]+\b/g, "[Filtered]")
		.replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, "[Filtered]")
		.replace(
			/([?&](?:token|key|password|secret|email|code|authorization)=)[^&#\s]*/gi,
			"$1[Filtered]",
		);
}

function stripQuery(url: string): string {
	return sanitizeText(url.split(/[?#]/)[0]);
}

export function sanitizeBreadcrumb(breadcrumb: Breadcrumb): Breadcrumb | null {
	// Console output can hold player names, room codes and mutation payloads.
	if (breadcrumb.category === "console") return null;
	return {
		...breadcrumb,
		message: breadcrumb.message ? sanitizeText(breadcrumb.message) : undefined,
		// Retain only structural network/navigation fields, never bodies/params.
		data: breadcrumb.data
			? Object.fromEntries(
					Object.entries(breadcrumb.data)
						.filter(([key]) =>
							["url", "method", "status_code", "from", "to", "state"].includes(
								key,
							),
						)
						.map(([key, value]) => [
							key,
							typeof value === "string" ? stripQuery(value) : value,
						]),
				)
			: undefined,
	};
}

export function sanitizeEvent<T extends Event>(event: T): T {
	if (event.user)
		event.user = event.user.id ? { id: event.user.id } : undefined;
	if (event.request) {
		event.request = {
			method: event.request.method,
			url: event.request.url ? stripQuery(event.request.url) : undefined,
		};
	}
	// No caller-supplied payloads, locals, or attachments are needed to debug.
	delete event.extra;
	if (event.message) event.message = sanitizeText(event.message);
	for (const exception of event.exception?.values ?? []) {
		if (exception.value) exception.value = sanitizeText(exception.value);
		for (const frame of exception.stacktrace?.frames ?? []) delete frame.vars;
	}
	return event;
}

/**
 * Feedback skips `beforeSend`, so the report the player typed needs its own
 * pass. Registered as a global event processor.
 */
export function sanitizeFeedbackEvent<T extends Event>(event: T): T {
	if (event.type !== "feedback") return event;
	const feedback = event.contexts?.feedback as
		| { message?: string; url?: string; contact_email?: string; name?: string }
		| undefined;
	if (feedback) {
		if (feedback.message) feedback.message = sanitizeText(feedback.message);
		if (feedback.url) feedback.url = stripQuery(feedback.url);
		delete feedback.contact_email;
		delete feedback.name;
	}
	return sanitizeEvent(event);
}

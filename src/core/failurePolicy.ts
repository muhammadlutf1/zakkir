export type InteractionFailureKind =
	| "autocomplete"
	| "messageComponent"
	| "chatInput";

export type FailureResponse =
	| { action: "log" }
	| { action: "reply"; content: string }
	| { action: "followUp"; content: string };

/**
 * The Dispatcher's single error policy: given the failing interaction's kind
 * and whether it was already responded to (replied or deferred), decide
 * whether to log without a response (autocomplete), reply, or follow up —
 * with the exact user-facing copy.
 */
export function decideFailureResponse(
	kind: InteractionFailureKind,
	responsive: boolean,
) {
	if (kind === "autocomplete") return { action: "log" };

	const content =
		kind === "messageComponent"
			? "There was an error while handling that component!"
			: "There was an error while executing this command!";

	return responsive
		? { action: "followUp", content }
		: { action: "reply", content };
}

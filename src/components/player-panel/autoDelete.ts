import type { InteractionReplyOptions } from "discord.js";
import type {
	DeletableMessage,
	FollowUpableInteraction,
	ReplyableInteraction,
} from "../../types";

export const AUTO_DELETE_MS = 3_000;
export const PANEL_REPLY_DELETE_MS = AUTO_DELETE_MS;
export const REPEAT_MENU_DELETE_MS = 10_000;

function scheduleDelete(
	message: DeletableMessage | null | undefined,
	ms = AUTO_DELETE_MS,
) {
	if (!message) return;
	const timer = setTimeout(() => {
		message.delete().catch(() => {});
	}, ms);
	timer.unref();
}

export async function replyWithAutoDelete(
	interaction: ReplyableInteraction,
	options: InteractionReplyOptions,
	deleteAfterMs = AUTO_DELETE_MS,
) {
	const response = (await interaction.reply({
		...options,
		withResponse: true,
	})) as
		| { resource?: { message?: DeletableMessage | null } | null }
		| null
		| undefined;
	// SAFETY: discord.js with withResponse:true returns InteractionResponse with resource; test mocks may return void
	scheduleDelete(response?.resource?.message, deleteAfterMs);
}

export async function followUpWithAutoDelete(
	interaction: FollowUpableInteraction,
	options: InteractionReplyOptions,
	deleteAfterMs = AUTO_DELETE_MS,
) {
	const message = await interaction.followUp(options);
	scheduleDelete(message, deleteAfterMs);
}

import type { Message, MessageComponentInteraction } from "discord.js";

type DeletableMessage = Pick<Message, "delete">;
type Replyable = Pick<MessageComponentInteraction<"cached">, "reply">;
type FollowUpable = Pick<MessageComponentInteraction<"cached">, "followUp">;

export const AUTO_DELETE_MS = 3_000;
export const PANEL_REPLY_DELETE_MS = AUTO_DELETE_MS;

function scheduleDelete(message: DeletableMessage | null | undefined) {
	if (!message) return;
	const timer = setTimeout(() => {
		message.delete().catch(() => {});
	}, AUTO_DELETE_MS);
	timer.unref();
}

export async function replyWithAutoDelete(
	interaction: Replyable,
	options: Record<string, unknown>,
) {
	const response = await interaction.reply({
		...options,
		withResponse: true,
	});

	scheduleDelete(response.resource?.message);
}

export async function followUpWithAutoDelete(
	interaction: FollowUpable,
	options: Record<string, unknown>,
) {
	const message = await interaction.followUp(options);

	scheduleDelete(message);
}

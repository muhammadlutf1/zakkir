import { MessageFlags } from "discord.js";
import type { Component } from "../../core/Component";

const component: Component = {
	match: (customId) =>
		customId === "radio:confirm" || customId === "radio:cancel",

	async execute(context, interaction) {
		// One seam call per path: the module owns the pending-Radio state
		// and the play/cancel behaviour; we only supply reply sinks.
		const input = {
			guildId: interaction.guildId,
			locale: context.locale,
			translator: context.translator,
			noticeChannel: interaction.channel ?? undefined,
			replyEphemeral: (content: string) =>
				interaction.reply({ content, flags: MessageFlags.Ephemeral }),
			update: (reply: { content: string }) =>
				interaction.update({ content: reply.content, components: [] }),
		};

		if (interaction.customId === "radio:confirm") {
			await context.playback.confirmRadio(input);
			return;
		}

		await context.playback.cancelRadio(input);
	},
};

export default component;

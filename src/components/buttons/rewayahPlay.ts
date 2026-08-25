import type { Component } from "../../core/Component";

const component: Component = {
	match: (customId) => customId.startsWith("rewayah-play:"),

	async execute(context, interaction) {
		await interaction.deferUpdate();

		// One seam call: the module settles the picker, resolves the chosen
		// Rewayah, and plays or asks for radio confirmation.
		await context.playback.pickRewayah({
			guildId: interaction.guildId,
			catalog: context.catalog,
			customId: interaction.customId,
			locale: context.locale,
			translator: context.translator,
			noticeChannel: interaction.channel ?? undefined,
			requestedBy: (interaction.user as unknown as { id?: string })?.id,
			editReply: (reply) => interaction.editReply(reply),
		});
	},
};

export default component;

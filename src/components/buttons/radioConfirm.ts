import { MessageFlags } from "discord.js";
import type { Component } from "../../core/Component";
import { formatPlayResult } from "../../play/playResult";
import { createLogger } from "../../core/logger";

const logger = createLogger("radioConfirm");

const component: Component = {
	id: "radio-confirm",
	match: (customId) => customId === "radio:confirm" || customId === "radio:cancel",

	async execute(context, interaction) {
		if (!interaction.inCachedGuild()) return;
		const guildId = interaction.guildId;
		if (!guildId) return;

		const player = context.players.get(guildId);

		if (!player) {
			await interaction.reply({
				content: context.translator.t("command.notConnected"),
				flags: MessageFlags.Ephemeral,
			});
			return;
		}

		if (interaction.customId === "radio:confirm") {
			const pending = player.takePendingRadioConfirm();
			if (!pending) {
				await interaction.reply({
					content: context.translator.t("command.resolveFailed"),
					flags: MessageFlags.Ephemeral,
				});
				return;
			}
			player.stopRadio();
			if (interaction.channel) {
				player.setNoticeChannel(interaction.channel);
			}
			try {
				const result = await player.play(pending);
				await interaction.update({
					content: formatPlayResult(pending, result, context.locale),
					components: [],
				});
			} catch (error) {
				logger.error(error, "Radio confirm play failed in guild %s", guildId);
				await interaction.update({
					content: context.translator.t("command.resolveFailed"),
					components: [],
				});
			}
			return;
		}

		// cancel
		player.clearPendingRadioConfirm();
		const station = player.radioInfo?.name ?? "radio";
		try {
			await interaction.update({
				content: context.translator.t("command.radioContinuing", { station }),
				components: [],
			});
		} catch (error) {
			logger.error(error, "Radio cancel update failed in guild %s", guildId);
		}
	},
};

export default component;

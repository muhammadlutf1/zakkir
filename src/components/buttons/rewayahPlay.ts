import {
	ActionRowBuilder,
	ButtonBuilder,
	ButtonStyle,
} from "discord.js";
import type { Component } from "../../core/Component";
import { recitationLabel } from "../../i18n/recitationLabel";
import { formatPlayResult } from "../../play/playResult";
import { buildRecitationFromChoice } from "../../play/resolvePlay";
import {
	parsePickerCustomId,
	RewayahPickerSession,
} from "../../play/rewayahPicker";

const component: Component = {
	id: "rewayah-play",
	match: (customId) => customId.startsWith("rewayah-play:"),

	async execute(context, interaction) {
		const parsed = parsePickerCustomId(interaction.customId);

		if (!parsed) return;

		await interaction.deferUpdate();
		const guildId = interaction.guildId;

		if (!guildId) return;

		const locale = context.locale;

		// A button press resolves the picker and cancels its timer.
		RewayahPickerSession.getSession(interaction.message.id)?.press();

		const player = context.players.get(guildId);

		if (!player?.isConnected) {
			await interaction.editReply({
				content: context.translator.t("command.notConnected"),
				components: [],
			});
			return;
		}

		const recitation = await buildRecitationFromChoice(
			context.catalog,
			{
				surahNumber: parsed.surahNumber,
				reciterId: parsed.reciterId,
				reciterName: "",
				rewayahId: parsed.rewayahId,
				rewayahName: "",
			},
			locale,
		).catch(() => undefined);

		if (!recitation) {
			await interaction.editReply({
				content: context.translator.t("command.resolveFailed"),
				components: [],
			});
			return;
		}

		if (interaction.channel) {
			player.setNoticeChannel(interaction.channel);
		}

		if (player.isRadioPlaying) {
			player.setPendingRadioConfirm(recitation);
			const station = player.radioInfo?.name ?? "radio";
			const label = recitationLabel(recitation, locale);
			const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
				new ButtonBuilder()
					.setCustomId("radio:confirm")
					.setLabel(context.translator.t("command.radioConfirmYes"))
					.setStyle(ButtonStyle.Success),
				new ButtonBuilder()
					.setCustomId("radio:cancel")
					.setLabel(context.translator.t("command.radioConfirmNo"))
					.setStyle(ButtonStyle.Secondary),
			);
			await interaction.editReply({
				content: context.translator.t("command.radioConfirmPrompt", {
					station,
					label,
				}),
				components: [row],
			});
			return;
		}

		const result = await player.play(recitation);

		await interaction.editReply({
			content: formatPlayResult(recitation, result, locale),
			components: [],
		});
	},
};

export default component;

import type { Component } from "../../core/Component";
import { formatPlayResult } from "../../play/playResult";
import { buildRecitationFromChoice } from "../../play/resolvePlay";
import {
	parsePickerCustomId,
	pickerSessionFor,
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

		// A button press resolves the picker and cancels its timer.
		pickerSessionFor(interaction.message.id)?.press();

		const player = context.players.get(guildId);

		if (!player?.isConnected) {
			await interaction.editReply({
				content: "I'm not connected to a voice channel in this server.",
				components: [],
			});
			return;
		}

		const recitation = await buildRecitationFromChoice(context.catalog, {
			surahNumber: parsed.surahNumber,
			reciterId: parsed.reciterId,
			reciterName: "",
			rewayahId: parsed.rewayahId,
			rewayahName: "",
		}).catch(() => undefined);

		if (!recitation) {
			await interaction.editReply({
				content: "Couldn't resolve that recitation.",
				components: [],
			});
			return;
		}

		if (interaction.channel) {
			player.setNoticeChannel(interaction.channel);
		}

		const result = await player.play(recitation);

		await interaction.editReply({
			content: formatPlayResult(recitation, result),
			components: [],
		});
	},
};

export default component;

import type { Component } from "../../core/Component";
import { setGuildNoticeChannel } from "../../play/noticeChannels";
import { buildRecitationFromChoice } from "../../play/resolvePlay";
import { clearPickerTimeout, parsePickerCustomId } from "../../play/rewayahPicker";

const component: Component = {
	id: "rewayah-play",
	match: (customId) => customId.startsWith("rewayah-play:"),

	async execute(bot, interaction) {
		const parsed = parsePickerCustomId(interaction.customId);

		if (!parsed) return;

		await interaction.deferUpdate();
		const guildId = interaction.guildId;

		if (!guildId) return;

		clearPickerTimeout(interaction.message.id);

		const player = bot.players.get(guildId);

		if (!player?.isConnected) {
			await interaction.editReply({
				content: "I'm not connected to a voice channel in this server.",
				components: [],
			});
			return;
		}

		const recitation = await buildRecitationFromChoice(bot.catalog, {
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

		if (interaction.channel && guildId) {
			setGuildNoticeChannel(guildId, interaction.channel);
		}

		const result = await player.play(recitation);

		await interaction.editReply({
			content: result.queued
				? `Added to the queue: ${recitation.surah.name} by ${recitation.reciterName} (${recitation.rewayahName}).`
				: result.started
					? `Playing ${recitation.surah.name} by ${recitation.reciterName} (${recitation.rewayahName}).`
					: `Couldn't play ${recitation.surah.name}. A notice was posted to the channel.`,
			components: [],
		});
	},
};

export default component;
import { ChannelType, MessageFlags, SlashCommandBuilder } from "discord.js";
import type { Command } from "../core/Command";

const radioCommand: Command = {
	data: new SlashCommandBuilder()
		.setName("radio")
		.setDescription("Play an endless radio station")
		.addStringOption((option) =>
			option
				.setName("station")
				.setDescription("Radio station name")
				.setRequired(true)
				.setAutocomplete(true),
		),

	async autocomplete(context, interaction) {
		const focused = interaction.options.getFocused(true);
		if (focused.name !== "station") return;
		const query = focused.value.trim().toLowerCase();
		const radios = await context.catalog.fetchRadios();
		const matches = radios
			.filter((radio) => radio.name.toLowerCase().includes(query))
			.slice(0, 25);
		await interaction.respond(
			matches.map((radio) => ({
				name: radio.name,
				value: String(radio.id),
			})),
		);
	},

	async execute(context, interaction) {
		const channel = interaction.member.voice.channel;

		if (!channel || channel.type === ChannelType.GuildStageVoice) {
			await interaction.reply({
				content: context.translator.t("command.needVoice"),
				flags: MessageFlags.Ephemeral,
			});
			return;
		}

		await interaction.deferReply({ ephemeral: true });

		const stationInput = interaction.options.getString("station", true);
		const radios = await context.catalog.fetchRadios();
		const radio =
			radios.find((r) => String(r.id) === stationInput.trim()) ??
			radios.find(
				(r) => r.name.toLowerCase() === stationInput.trim().toLowerCase(),
			);

		if (!radio) {
			await interaction.editReply({
				content: context.translator.t("command.radioStationNotFound", {
					station: stationInput,
				}),
			});
			return;
		}

		await context.playback.requestQueueToRadio({
			guildId: interaction.guildId,
			radio,
			locale: context.locale,
			translator: context.translator,
			voiceChannel: channel,
			noticeChannel: interaction.channel ?? undefined,
			requestedBy: interaction.user.id,
			editReply: (reply) => interaction.editReply(reply),
		});
	},
};

export default radioCommand;

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
		const radios = await context.catalog.fetchRadios(context.locale);
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
		if (!interaction.inCachedGuild()) return;

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
		const radios = await context.catalog.fetchRadios(context.locale);
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

		const player = context.players.getOrCreate(interaction.guildId);
		await player.join(channel);

		if (interaction.channel) {
			player.setNoticeChannel(interaction.channel);
		}

		await player.playRadio(radio);

		await interaction.editReply({
			content: context.translator.t("command.radioStarted", {
				station: radio.name,
			}),
		});
	},
};

export default radioCommand;

import { MessageFlags, SlashCommandBuilder } from "discord.js";
import { handleSkipWithGate } from "../access/skipAccess";
import type { Command } from "../core/Command";
import { recitationLabel } from "../i18n/recitationLabel";

const skipCommand: Command = {
	data: new SlashCommandBuilder()
		.setName("skip")
		.setDescription("Skip the current recitation"),

	async execute(context, interaction) {
		const player = context.players.get(interaction.guildId);

		if (!player) {
			await interaction.reply({
				content: context.translator.t("command.nothingPlaying"),
				flags: MessageFlags.Ephemeral,
			});
			return;
		}

		if (player.isPlaying === false) {
			await interaction.reply({
				content: context.translator.t("command.nothingToSkip"),
				flags: MessageFlags.Ephemeral,
			});
			return;
		}

		const current = player.queueView.current;
		const resolvedChannel = interaction.channel ?? undefined;

		const gate = await handleSkipWithGate({
			player,
			member: interaction.member,
			guildId: interaction.guildId,
			locale: context.locale,
			translator: context.translator,
			votes: context.votes,
			channel: resolvedChannel,
			recitation: current ?? undefined,
		});

		if (gate.kind === "voted") {
			await interaction.reply({
				content: context.translator.t("vote.started"),
				flags: MessageFlags.Ephemeral,
			});
			return;
		}

		// Qualified or fallback (noVoters) — act directly with no vote message.
		const result = await player.skip();

		if (!result.started) {
			await interaction.reply(context.translator.t("command.playbackEnded"));
			return;
		}

		const next = player.queueView.current;

		await interaction.reply(
			next
				? context.translator.t("command.nowPlaying", {
						label: recitationLabel(next, context.locale),
					})
				: context.translator.t("command.skipped"),
		);
	},
};

export default skipCommand;

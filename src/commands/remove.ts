import { MessageFlags, SlashCommandBuilder } from "discord.js";
import { gateOrVoteStarted } from "../access/actionGate";
import type { Command } from "../core/Command";
import { recitationLabel } from "../i18n/recitationLabel";

const removeCommand: Command = {
	data: new SlashCommandBuilder()
		.setName("remove")
		.setDescription("Remove a queued recitation")
		.addIntegerOption((option) =>
			option
				.setName("position")
				.setDescription("1-based position of the queued recitation to remove")
				.setRequired(true)
				.setMinValue(1),
		),

	async execute(context, interaction) {
		const player = context.players.get(interaction.guildId);

		if (!player) {
			await interaction.reply({
				content: context.translator.t("command.nothingPlaying"),
				flags: MessageFlags.Ephemeral,
			});
			return;
		}

		const position = interaction.options.getInteger("position", true);
		const upcoming = player.queueView.upcoming;

		if (position > upcoming.length) {
			await interaction.reply({
				content: context.translator.t("command.onlyQueued", {
					count: upcoming.length,
					s: upcoming.length === 1 ? "" : "s",
				}),
				flags: MessageFlags.Ephemeral,
			});
			return;
		}

		// The relevant Recitation for requester qualification is the one being
		// removed, not the one currently playing.
		const target = upcoming[position - 1];

		if (
			!(await gateOrVoteStarted(
				{
					player,
					member: interaction.member,
					guildId: interaction.guildId,
					locale: context.locale,
					translator: context.translator,
					votes: context.votes,
					channel: interaction.channel ?? undefined,
					recitation: target,
					directAllowed: target?.requestedBy === interaction.member.id,
					action: context.translator.t("vote.action.remove", {
						label: target ? recitationLabel(target, context.locale) : "",
					}),
					onPass: async () => {
						player.remove(position + 1);
					},
				},
				interaction,
				context.translator,
			))
		) {
			return;
		}

		// Queue positions are 1-based over the whole queue (current at 1), so an
		// upcoming position N maps to queue position N + 1.
		player.remove(position + 1);

		await interaction.reply(
			context.translator.t("command.removed", { position: String(position) }),
		);
	},
};

export default removeCommand;

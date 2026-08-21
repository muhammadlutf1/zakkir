import {
	ActionRowBuilder,
	ButtonBuilder,
	ButtonStyle,
	type GuildMember,
	type MessageComponentInteraction,
	MessageFlags,
} from "discord.js";
import type { ComponentContext } from "../../core/interactionContext";
import { PANEL_REPEAT_CUSTOM_ID } from "../../play/playerPanel";
import type { Player } from "../../voice/Player";
import { RepeatMode } from "../../voice/Queue";

const REPEAT_MODES: Array<{ mode: RepeatMode; label: string }> = [
	{ mode: RepeatMode.OFF, label: "Off" },
	{ mode: RepeatMode.TRACK, label: "Track" },
	{ mode: RepeatMode.ALL, label: "All" },
];

/**
 * Resolves the Player for the interaction's guild after the two shared gates:
 * a session must exist, and the interactor must sit in the bot's voice
 * channel. Each failure answers with an ephemeral reply instead.
 */
export async function resolvePanelPlayer(
	context: ComponentContext,
	interaction: MessageComponentInteraction,
): Promise<Player | undefined> {
	const player = interaction.guildId
		? context.players.get(interaction.guildId)
		: undefined;

	if (!player) {
		await interaction.reply({
			content: context.translator.t("command.notInVoice"),
			flags: MessageFlags.Ephemeral,
		});
		return undefined;
	}

	const interactorChannelId = (interaction.member as GuildMember | null)?.voice
		?.channelId;

	if (interactorChannelId !== player.voiceChannelId) {
		await interaction.reply({
			content: context.translator.t("command.needVoice"),
			flags: MessageFlags.Ephemeral,
		});
		return undefined;
	}

	return player;
}

/** One row of Off/Track/All buttons; the current mode is disabled. */
export function buildRepeatRow(current: RepeatMode, disabled = false) {
	const row = new ActionRowBuilder<ButtonBuilder>();

	for (const { mode, label } of REPEAT_MODES) {
		row.addComponents(
			new ButtonBuilder()
				.setCustomId(`${PANEL_REPEAT_CUSTOM_ID}:${mode}`)
				.setLabel(label)
				.setStyle(ButtonStyle.Secondary)
				.setDisabled(disabled || mode === current),
		);
	}

	return row;
}

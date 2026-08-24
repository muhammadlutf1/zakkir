import {
	ActionRowBuilder,
	ButtonBuilder,
	ButtonStyle,
	type MessageComponentInteraction,
	MessageFlags,
} from "discord.js";
import type { ComponentContext } from "../../core/interactionContext";
import { type Locale, localizable } from "../../i18n/locale";
import type { MessageKey } from "../../i18n/messages/en";
import { PANEL_REPEAT_CUSTOM_ID } from "../../play/playerPanel";
import type { Player } from "../../voice/Player";
import { RepeatMode } from "../../voice/Queue";

const REPEAT_MODES: Array<{ mode: RepeatMode; key: MessageKey }> = [
	{ mode: RepeatMode.OFF, key: "panel.repeatOff" },
	{ mode: RepeatMode.CURRENT, key: "panel.repeatCurrent" },
	{ mode: RepeatMode.ALL, key: "panel.repeatAll" },
];

/**
 * Resolves the Player for the interaction's guild after the two shared gates:
 * a session must exist, and the interactor must sit in the bot's voice
 * channel. Each failure answers with an ephemeral reply instead.
 */
export async function resolvePanelPlayer(
	context: ComponentContext,
	interaction: MessageComponentInteraction<"cached">,
): Promise<Player | undefined> {
	const player = context.players.get(interaction.guildId);

	if (!player) {
		await interaction.reply({
			content: context.translator.t("command.notInVoice"),
			flags: MessageFlags.Ephemeral,
		});
		return undefined;
	}

	const interactorChannelId = interaction.member.voice?.channelId;

	if (interactorChannelId !== player.voiceChannelId) {
		await interaction.reply({
			content: context.translator.t("command.needVoice"),
			flags: MessageFlags.Ephemeral,
		});
		return undefined;
	}

	return player;
}

/** One row of Off/Current/All buttons; the current mode is disabled. */
export function buildRepeatRow(
	current: RepeatMode,
	locale: Locale,
	disabled = false,
) {
	const translator = localizable(locale);
	const row = new ActionRowBuilder<ButtonBuilder>();

	for (const { mode, key } of REPEAT_MODES) {
		row.addComponents(
			new ButtonBuilder()
				.setCustomId(`${PANEL_REPEAT_CUSTOM_ID}:${mode}`)
				.setLabel(translator.t(key))
				.setStyle(ButtonStyle.Secondary)
				.setDisabled(disabled || mode === current),
		);
	}

	return row;
}

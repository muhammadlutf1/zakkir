import {
	ActionRowBuilder,
	ButtonBuilder,
	ButtonStyle,
	ContainerBuilder,
	type Message,
	MessageFlags,
	type PartialGroupDMChannel,
	SeparatorBuilder,
	StringSelectMenuBuilder,
	StringSelectMenuOptionBuilder,
	type TextBasedChannel,
	TextDisplayBuilder,
} from "discord.js";
import { surahName } from "../catalog/suwar";
import { createLogger } from "../core/logger";
import type { Locale } from "../i18n/locale";
import type { Player } from "../voice/Player";

type SendableTextChannel = Exclude<TextBasedChannel, PartialGroupDMChannel>;

const logger = createLogger("playerPanel");

const BOOK_EMOJI = "<:book:1384273893149249546>";
const PAUSE_EMOJI = "<:pause:1384273881040289924>";
const PLAY_EMOJI = "<:play:1384273884622229514>";
const STOP_EMOJI = "<:stop:1384273886652137665>";
const FORWARD_EMOJI = "<:forward:1384273873427759278>";
const REPEAT_EMOJI = "<:repeat:1384278335114449060>";

export const PANEL_SELECT_CUSTOM_ID = "player-panel:select";
export const PANEL_PAUSE_CUSTOM_ID = "player-panel:pause";
export const PANEL_STOP_CUSTOM_ID = "player-panel:stop";
export const PANEL_SKIP_CUSTOM_ID = "player-panel:skip";
export const PANEL_REPEAT_CUSTOM_ID = "player-panel:repeat";

const ACCENT_COLOR = 0x2b2d31;
const NOTE_TEXT =
	"Note: To skip without clearing previous tracks (in order), set loop mode to 'All' first";
const EMPTY_QUEUE_PLACEHOLDER = "No tracks queued";
const MAX_SELECT_OPTIONS = 25;
const BURIED_WINDOW = 15;

/** Read-only view of the active panel for a guild, if one exists. */
export interface PanelSnapshot {
	messageId: string;
	channelId: string;
}

interface PanelEntry {
	message: Message;
	player: Player;
	channel: SendableTextChannel;
	locale: Locale;
	updating: boolean;
	dirty: boolean;
	dispose: () => void;
}

/**
 * One panel per guild, keyed by guild id — the same static-registry style as
 * RewayahPickerSession.
 */
const panels = new Map<string, PanelEntry>();

/**
 * Renders the panel's full components-v2 payload from the Player's current
 * state. `disabled` grays out every interactive component (used on session
 * end); the message content itself never changes.
 */
export function buildPanelPayload(
	player: Player,
	locale: Locale,
	disabled = false,
) {
	return {
		components: [buildContainer(player, locale, disabled)],
		flags: MessageFlags.IsComponentsV2 as number,
	};
}

function buildContainer(player: Player, locale: Locale, disabled: boolean) {
	const view = player.queueView;
	const current = view.current;
	const texts: TextDisplayBuilder[] = [];

	if (current) {
		texts.push(
			new TextDisplayBuilder().setContent(
				`${BOOK_EMOJI} Surah ${surahName(current.surah, locale)} by ${current.reciterName}`,
			),
		);

		if (
			current.rewayahName.toLowerCase() !== current.reciterName.toLowerCase()
		) {
			texts.push(new TextDisplayBuilder().setContent(current.rewayahName));
		}
	}

	texts.push(
		new TextDisplayBuilder().setContent(
			`Repeat Mode: ${view.repeatMode.toUpperCase()}`,
		),
	);

	const container = new ContainerBuilder()
		.setAccentColor(ACCENT_COLOR)
		.addTextDisplayComponents(...texts)
		.addSeparatorComponents(new SeparatorBuilder())
		.addActionRowComponents(buildSelectRow(player, locale, disabled))
		.addActionRowComponents(buildControlsRow(player, disabled))
		.addTextDisplayComponents(new TextDisplayBuilder().setContent(NOTE_TEXT));

	return container;
}

function buildSelectRow(player: Player, locale: Locale, disabled: boolean) {
	const view = player.queueView;
	const entries = view.current ? [view.current, ...view.upcoming] : [];
	const select = new StringSelectMenuBuilder().setCustomId(
		PANEL_SELECT_CUSTOM_ID,
	);

	if (entries.length === 0) {
		select.setPlaceholder(EMPTY_QUEUE_PLACEHOLDER);
	} else {
		select.addOptions(
			entries.slice(0, MAX_SELECT_OPTIONS).map((recitation, index) => {
				const option = new StringSelectMenuOptionBuilder()
					.setValue(`track-${index}`)
					.setLabel(
						`${surahName(recitation.surah, locale)} - ${recitation.reciterName}`,
					);
				if (index === 0) option.setDefault(true);
				return option;
			}),
		);
	}

	select.setDisabled(disabled || entries.length === 0);

	return new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(select);
}

function buildControlsRow(player: Player, disabled: boolean) {
	const paused = player.isPaused;
	const pauseButton = new ButtonBuilder()
		.setCustomId(PANEL_PAUSE_CUSTOM_ID)
		.setLabel(paused ? "Resume" : "Pause")
		.setEmoji(paused ? PLAY_EMOJI : PAUSE_EMOJI)
		.setStyle(ButtonStyle.Secondary);

	const stopButton = new ButtonBuilder()
		.setCustomId(PANEL_STOP_CUSTOM_ID)
		.setLabel("Stop")
		.setEmoji(STOP_EMOJI)
		.setStyle(ButtonStyle.Secondary);

	const skipButton = new ButtonBuilder()
		.setCustomId(PANEL_SKIP_CUSTOM_ID)
		.setLabel("Skip")
		.setEmoji(FORWARD_EMOJI)
		.setStyle(ButtonStyle.Secondary);

	const repeatButton = new ButtonBuilder()
		.setCustomId(PANEL_REPEAT_CUSTOM_ID)
		.setLabel("Loop")
		.setEmoji(REPEAT_EMOJI)
		.setStyle(ButtonStyle.Secondary);

	return new ActionRowBuilder<ButtonBuilder>().addComponents(
		pauseButton.setDisabled(disabled),
		stopButton.setDisabled(disabled),
		skipButton.setDisabled(disabled),
		repeatButton.setDisabled(disabled),
	);
}

/**
 * Posts the guild's PlayerPanel in the channel and wires it to the Player:
 * every playback-state change re-renders the panel in place, and session end
 * disables its controls while keeping the message up. Replaces any existing
 * panel for the guild.
 */
export async function createPanel(
	player: Player,
	channel: SendableTextChannel,
	locale: Locale,
): Promise<Message> {
	const existing = panels.get(player.guildId);
	existing?.dispose();

	const message = await channel.send(buildPanelPayload(player, locale));
	registerPanel(player, channel, locale, message);

	return message;
}

/**
 * Re-renders the guild's panel in place. Before editing it runs the buried
 * check — a panel scrolled past the recent-message window is deleted and
 * reposted at the bottom instead; an externally deleted panel is reposted
 * fresh. Overlapping calls collapse into one trailing refresh.
 */
export function updatePanel(guildId: string) {
	const entry = panels.get(guildId);
	if (!entry) return;
	if (entry.updating) {
		entry.dirty = true;
		return;
	}

	void refreshEntry(entry);
}

export function getPanel(guildId: string): PanelSnapshot | undefined {
	const entry = panels.get(guildId);
	if (!entry) return undefined;

	return { messageId: entry.message.id, channelId: entry.channel.id };
}

export function hasPanel(guildId: string) {
	return panels.has(guildId);
}

function registerPanel(
	player: Player,
	channel: SendableTextChannel,
	locale: Locale,
	message: Message,
) {
	const offChange = player.onChange(() => updatePanel(player.guildId));
	const offEnd = player.onEnd(() => {
		void disablePanel(player.guildId);
	});
	const dispose = () => {
		offChange();
		offEnd();
		panels.delete(player.guildId);
	};

	panels.set(player.guildId, {
		message,
		player,
		channel,
		locale,
		updating: false,
		dirty: false,
		dispose,
	});
}

async function refreshEntry(entry: PanelEntry) {
	entry.updating = true;

	try {
		const payload = buildPanelPayload(entry.player, entry.locale);
		const buried = await isBuried(entry);

		if (!buried) {
			try {
				await entry.message.edit(payload);
				return;
			} catch (error) {
				logger.warn(
					error,
					"Panel edit failed in guild %s — reposting",
					entry.player.guildId,
				);
			}
		}

		await entry.message.delete().catch((error: unknown) => {
			logger.debug(
				error,
				"Old panel already gone in guild %s",
				entry.player.guildId,
			);
		});
		entry.message = await entry.channel.send(payload);
	} catch (error) {
		logger.error(
			error,
			"Panel refresh failed in guild %s",
			entry.player.guildId,
		);
	} finally {
		entry.updating = false;
		if (entry.dirty && panels.get(entry.player.guildId) === entry) {
			entry.dirty = false;
			void refreshEntry(entry);
		}
	}
}

async function isBuried(entry: PanelEntry): Promise<boolean> {
	try {
		const recent = await entry.channel.messages.fetch({ limit: BURIED_WINDOW });
		return !recent.has(entry.message.id);
	} catch (error) {
		logger.warn(
			error,
			"Could not fetch recent messages in guild %s — treating panel as buried",
			entry.player.guildId,
		);
		return true;
	}
}

/** Disables every control on the panel and forgets the registry entry. */
async function disablePanel(guildId: string) {
	const entry = panels.get(guildId);
	if (!entry) return;

	entry.dispose();

	const payload = buildPanelPayload(entry.player, entry.locale, true);
	try {
		await entry.message.edit(payload);
	} catch (error) {
		logger.warn(error, "Could not disable panel in guild %s", guildId);
	}
}

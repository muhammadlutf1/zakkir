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
import { type Locale, localizable } from "../i18n/locale";
import type { Player } from "../voice/Player";

type SendableTextChannel = Exclude<TextBasedChannel, PartialGroupDMChannel>;

const logger = createLogger("playerPanel");

export const PANEL_SELECT_CUSTOM_ID = "player-panel:select";
export const PANEL_PAUSE_CUSTOM_ID = "player-panel:pause";
export const PANEL_STOP_CUSTOM_ID = "player-panel:stop";
export const PANEL_SKIP_CUSTOM_ID = "player-panel:skip";
export const PANEL_REPEAT_CUSTOM_ID = "player-panel:repeat";

const MAX_SELECT_OPTIONS = 25;
const BURIED_WINDOW = 15;

export type PanelEndState =
	| { kind: "finished" }
	| { kind: "stoppedBy"; user: string };

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
	status?: PanelEndState;
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
 * end); the controls also gray out on their own once the Queue drains
 * naturally and no Radio plays. The message content itself never changes.
 */
export function buildPanelPayload(
	player: Player,
	locale: Locale,
	disabled = false,
	status?: PanelEndState,
) {
	return {
		components: [buildContainer(player, locale, disabled, status)],
		flags: MessageFlags.IsComponentsV2 as number,
	};
}

function buildContainer(
	player: Player,
	locale: Locale,
	disabled: boolean,
	status?: PanelEndState,
) {
	const translator = localizable(locale);
	const view = player.queueView;
	const current = view.current;
	const texts: TextDisplayBuilder[] = [];

	if (status?.kind === "stoppedBy") {
		texts.push(
			new TextDisplayBuilder().setContent(
				translator.t("panel.stoppedBy", { user: status.user }),
			),
		);
	} else if (player.isRadioPlaying) {
		const station = player.radioInfo?.name ?? "radio";
		texts.push(
			new TextDisplayBuilder().setContent(
				`## ${translator.t("emote.microphone")} ${translator.t("panel.radioTitle", { station })}`,
			),
		);
		const modeLabel = translator.t(`repeat.mode.${view.repeatMode}` as never);
		texts.push(
			new TextDisplayBuilder().setContent(
				translator.t("panel.repeatMode", { mode: modeLabel }),
			),
		);
	} else if (current) {
		texts.push(
			new TextDisplayBuilder().setContent(
				`## ${translator.t("emote.book")} ${translator.t("panel.title", {
					surah: surahName(current.surah, locale),
					reciter: current.reciterName,
				})}`,
			),
		);

		// Hide rewayah subtitle when it duplicates the reciter name (some moshafs repeat it).
		if (
			current.rewayahName.toLowerCase() !== current.reciterName.toLowerCase()
		) {
			texts.push(new TextDisplayBuilder().setContent(current.rewayahName));
		}

		const modeLabel = translator.t(`repeat.mode.${view.repeatMode}` as never);
		texts.push(
			new TextDisplayBuilder().setContent(
				translator.t("panel.repeatMode", { mode: modeLabel }),
			),
		);
	} else {
		texts.push(
			new TextDisplayBuilder().setContent(translator.t("panel.finished")),
		);
		const modeLabel = translator.t(`repeat.mode.${view.repeatMode}` as never);
		texts.push(
			new TextDisplayBuilder().setContent(
				translator.t("panel.repeatMode", { mode: modeLabel }),
			),
		);
	}

	const drained = !current && !player.isRadioPlaying;
	const effectiveDisabled = disabled || drained;

	const container = new ContainerBuilder()
		.addTextDisplayComponents(...texts)
		.addSeparatorComponents(new SeparatorBuilder())
		.addActionRowComponents(buildSelectRow(player, locale, effectiveDisabled))
		.addActionRowComponents(buildControlsRow(player, locale, effectiveDisabled))
		.addTextDisplayComponents(
			new TextDisplayBuilder().setContent(`-# ${translator.t("panel.note")}`),
		);

	return container;
}

function buildSelectRow(player: Player, locale: Locale, disabled: boolean) {
	const translator = localizable(locale);
	const view = player.queueView;
	const entries = view.current ? [view.current, ...view.upcoming] : [];
	const select = new StringSelectMenuBuilder().setCustomId(
		PANEL_SELECT_CUSTOM_ID,
	);

	if (entries.length === 0) {
		const placeholder = translator.t("panel.noTracks");
		select.setPlaceholder(placeholder);
		select.addOptions(
			new StringSelectMenuOptionBuilder()
				.setValue("empty")
				.setLabel(placeholder)
				.setDefault(true),
		);
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

function buildControlsRow(player: Player, locale: Locale, disabled: boolean) {
	const translator = localizable(locale);
	const paused = player.isPaused;
	const isRadio = player.isRadioPlaying;
	const pauseButton = new ButtonBuilder()
		.setCustomId(PANEL_PAUSE_CUSTOM_ID)
		.setLabel(
			paused
				? translator.t("panel.buttonResume")
				: translator.t("panel.buttonPause"),
		)
		.setEmoji(paused ? translator.t("emote.play") : translator.t("emote.pause"))
		.setStyle(ButtonStyle.Secondary);

	const stopButton = new ButtonBuilder()
		.setCustomId(PANEL_STOP_CUSTOM_ID)
		.setLabel(translator.t("panel.buttonStop"))
		.setEmoji(translator.t("emote.stop"))
		.setStyle(ButtonStyle.Secondary);

	const skipButton = new ButtonBuilder()
		.setCustomId(PANEL_SKIP_CUSTOM_ID)
		.setLabel(translator.t("panel.buttonSkip"))
		.setEmoji(translator.t("emote.forward"))
		.setStyle(ButtonStyle.Secondary);

	const repeatButton = new ButtonBuilder()
		.setCustomId(PANEL_REPEAT_CUSTOM_ID)
		.setLabel(translator.t("panel.buttonLoop"))
		.setEmoji(translator.t("emote.repeat"))
		.setStyle(ButtonStyle.Secondary);

	return new ActionRowBuilder<ButtonBuilder>().addComponents(
		pauseButton.setDisabled(disabled),
		stopButton.setDisabled(disabled),
		skipButton.setDisabled(disabled || isRadio),
		repeatButton.setDisabled(disabled || isRadio),
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

/**
 * Deletes the guild's tracked panel message and clears its registry entry,
 * tolerating a message that is already gone. Used by admin `/panel` reposts.
 */
export async function deletePanel(guildId: string) {
	const entry = panels.get(guildId);
	if (!entry) return;
	entry.dispose();

	try {
		await entry.message.delete();
	} catch (error) {
		if ((error as { code?: number })?.code === 10008) return;
		logger.warn(error, "Could not delete old panel in guild %s", guildId);
	}
}

/**
 * Reposts the guild's panel from scratch in the given channel: any previous
 * panel message is deleted and a fresh one takes over the tracking. Resolves
 * to whether a new panel is now tracked.
 */
export async function repostPanel(
	player: Player,
	channel: SendableTextChannel,
	locale: Locale,
) {
	await deletePanel(player.guildId);

	try {
		await createPanel(player, channel, locale);
		return true;
	} catch (error) {
		logger.error(error, "Could not repost panel in guild %s", player.guildId);
		return false;
	}
}

export function setPanelStatus(guildId: string, status: PanelEndState) {
	const entry = panels.get(guildId);
	if (!entry) return;
	entry.status = status;
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
		const payload = buildPanelPayload(
			entry.player,
			entry.locale,
			false,
			entry.status,
		);
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
			if ((error as { code?: number })?.code === 10008) return;
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

	const payload = buildPanelPayload(
		entry.player,
		entry.locale,
		true,
		entry.status,
	);
	try {
		await entry.message.edit(payload);
	} catch (error) {
		logger.warn(error, "Could not disable panel in guild %s", guildId);
	}
}

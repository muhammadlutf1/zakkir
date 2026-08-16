import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from "discord.js";
import type { Catalog } from "../catalog/Catalog";
import type { Surah } from "../catalog/surahs";
import { createLogger } from "../core/logger";
import type { Player } from "../voice/Player";
import { buildRecitationFromChoice, type RewayahChoice } from "./resolvePlay";

const logger = createLogger("rewayahPicker");
const CUSTOM_ID_PREFIX = "rewayah-play:";
const MAX_BUTTONS_PER_ROW = 5;

export function pickerCustomId(choice: RewayahChoice): string {
	return `${CUSTOM_ID_PREFIX}${choice.surahNumber}:${choice.reciterId}:${choice.rewayahId}`;
}

export function parsePickerCustomId(
	customId: string,
): { surahNumber: number; reciterId: number; rewayahId: number } | undefined {
	if (!customId.startsWith(CUSTOM_ID_PREFIX)) return undefined;

	const [, surahNumber, reciterId, rewayahId] = customId.split(":");
	const surah = Number(surahNumber);
	const reciter = Number(reciterId);
	const rewayah = Number(rewayahId);

	if (
		!Number.isInteger(surah) ||
		!Number.isInteger(reciter) ||
		!Number.isInteger(rewayah)
	) {
		return undefined;
	}

	return { surahNumber: surah, reciterId: reciter, rewayahId: rewayah };
}

export interface PickerOptions {
	surah: Surah;
	reciterName: string;
	choices: RewayahChoice[];
}

export function renderPicker(options: PickerOptions): {
	content: string;
	components: ActionRowBuilder<ButtonBuilder>[];
} {
	const content = [
		`Available Riwayat for Surah ${options.surah.name} (${options.surah.number}) by ${options.reciterName}:`,
		...options.choices.map(
			(choice, index) => `${index + 1}. ${choice.rewayahName}`,
		),
		"Pick a Rewayah to play it.",
	].join("\n");

	const buttons = options.choices.map((choice) =>
		new ButtonBuilder()
			.setCustomId(pickerCustomId(choice))
			.setLabel(choice.rewayahName)
			.setStyle(ButtonStyle.Primary),
	);

	const components: ActionRowBuilder<ButtonBuilder>[] = [];

	for (let i = 0; i < buttons.length; i += MAX_BUTTONS_PER_ROW) {
		components.push(
			new ActionRowBuilder<ButtonBuilder>().addComponents(
				buttons.slice(i, i + MAX_BUTTONS_PER_ROW),
			),
		);
	}

	return { content, components };
}

export interface PendingPicker {
	cancel(): void;
}

const pending = new Map<string, PendingPicker>();

export function registerPickerTimeout(
	messageId: string,
	options: { timeoutMs: number; onTimeout: () => void },
): PendingPicker {
	const timer = setTimeout(() => {
		pending.delete(messageId);
		Promise.resolve(options.onTimeout()).catch((error) => {
			logger.error(error, "Picker timeout action failed");
		});
	}, options.timeoutMs);

	timer.unref();

	const entry: PendingPicker = {
		cancel() {
			clearTimeout(timer);
			pending.delete(messageId);
		},
	};

	pending.set(messageId, entry);

	return entry;
}

export function clearPickerTimeout(messageId: string) {
	pending.get(messageId)?.cancel();
}

export interface PickerTimeoutContext {
	catalog: Catalog;
	player: Player;
	followUp: (content: string) => Promise<unknown>;
}

/**
 * Runs the picker-timeout action: auto-plays the resolved default Rewayah, or
 * cancels with a notice when there is no default.
 */
export async function handlePickerTimeout(
	context: PickerTimeoutContext,
	defaultChoice: RewayahChoice | undefined,
): Promise<void> {
	if (!defaultChoice) {
		await context.followUp(
			"Nothing picked — no default Rewayah is set. Playback cancelled.",
		);
		return;
	}

	const recitation = await buildRecitationFromChoice(context.catalog, defaultChoice);
	const result = await context.player.play(recitation);

	if (result.queued) {
		await context.followUp(
			`Added to the queue: ${recitation.surah.name} by ${recitation.reciterName} (${recitation.rewayahName}).`,
		);
	} else if (result.started) {
		await context.followUp(
			`Playing ${recitation.surah.name} by ${recitation.reciterName} (${recitation.rewayahName}).`,
		);
	} else {
		await context.followUp(
			`Couldn't auto-play ${recitation.rewayahName}. A notice was posted to the channel.`,
		);
	}
}

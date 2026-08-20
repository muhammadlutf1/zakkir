import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from "discord.js";
import type { Catalog } from "../catalog/Catalog";
import type { Surah } from "../catalog/suwar";
import { surahName } from "../catalog/suwar";
import { DEFAULT_LOCALE } from "../config";
import { createLogger } from "../core/logger";
import { localizable, type Locale } from "../i18n/locale";
import type { Player } from "../voice/Player";
import { formatPlayResult } from "./playResult";
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
	locale?: Locale;
}

export function renderPicker(options: PickerOptions): {
	content: string;
	components: ActionRowBuilder<ButtonBuilder>[];
} {
	const locale = options.locale ?? DEFAULT_LOCALE;
	const { t } = localizable(locale);
	const surah = surahName(options.surah, locale);

	const content = [
		t("picker.header", {
			surah,
			number: String(options.surah.number),
			reciter: options.reciterName,
		}),
		...options.choices.map(
			(choice, index) => `${index + 1}. ${choice.rewayahName}`,
		),
		t("picker.prompt"),
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

export interface PickerSessionOptions {
	timeoutMs: number;
	defaultChoice: RewayahChoice | undefined;
	catalog: Catalog;
	player: Player;
	followUp: (content: string) => Promise<unknown>;
	locale?: Locale;
}

/**
 * One picker's whole lifecycle. Constructing a session registers it in the
 * shared registry and arms its timeout, so "just make the instance" is enough
 * setup. The session owns its timeout timer, its resolution on a button press,
 * and its follow-up notice binding — it replaces the module-global timeout /
 * notice maps. Keyed to the session, not a bare message id, so pressing a
 * button reliably cancels that picker's timer.
 */
export class RewayahPickerSession {
	private static readonly sessions = new Map<string, RewayahPickerSession>();

	private timer: NodeJS.Timeout | null = null;
	private resolved = false;

	constructor(
		private readonly messageId: string,
		private readonly options: PickerSessionOptions,
	) {
		RewayahPickerSession.sessions.set(this.messageId, this);
		this.start();
	}

	/** The pending picker for a message, or `undefined` if none is active. */
	static getSession(messageId: string) {
		return RewayahPickerSession.sessions.get(messageId);
	}

	/** True while the picker is still awaiting a button press. */
	get isPending() {
		return !this.resolved;
	}

	/**
	 * Arms the timeout that auto-plays the resolved default Rewayah, or posts
	 * the "nothing picked" notice when there is no default. Called on
	 * construction; idempotent.
	 */
	start() {
		if (this.resolved || this.timer) return;

		this.timer = setTimeout(() => {
			this.timer = null;
			this.timeout().catch((error) => {
				logger.error(error, "Picker timeout action failed");
			});
		}, this.options.timeoutMs);

		this.timer.unref();
	}

	/**
	 * A button press resolves the picker and cancels its timer, so the timeout
	 * can never fire after the pick has been made.
	 */
	press() {
		if (this.timer) clearTimeout(this.timer);
		this.timer = null;
		this.settle();
	}

	/**
	 * Fires the picker's timeout: auto-plays the resolved default Rewayah, or
	 * posts the "nothing picked" notice when there is no default. Settles the
	 * picker exactly once.
	 */
	async timeout() {
		if (this.resolved) return;

		this.settle();

		if (!this.options.defaultChoice) {
			const { t } = localizable(this.options.locale ?? DEFAULT_LOCALE);
			await this.options.followUp(t("picker.timeoutNoDefault"));
			return;
		}

		const recitation = await buildRecitationFromChoice(
			this.options.catalog,
			this.options.defaultChoice,
			this.options.locale,
		);
		const result = await this.options.player.play(recitation);

		await this.options.followUp(
			formatPlayResult(recitation, result, this.options.locale),
		);
	}

	private settle() {
		this.resolved = true;
		RewayahPickerSession.sessions.delete(this.messageId);
	}
}

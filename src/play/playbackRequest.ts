import type { TextBasedChannel, VoiceChannel } from "discord.js";
import {
	ActionRowBuilder,
	ButtonBuilder,
	ButtonStyle,
	ContainerBuilder,
	MediaGalleryBuilder,
	MediaGalleryItemBuilder,
	MessageFlags,
	SectionBuilder,
	SeparatorBuilder,
	TextDisplayBuilder,
} from "discord.js";
import type { Catalog, Rewayah } from "../catalog/Catalog";
import { type Surah, surahName } from "../catalog/suwar";
import { DEFAULT_LOCALE } from "../config";
import { createLogger } from "../core/logger";
import type { GuildConfig } from "../guild/GuildConfig";
import type { GlobalDefaults, RewayahCoverage } from "../guild/types";
import { type Locale, type Localizable, localizable } from "../i18n/locale";
import { recitationLabel } from "../i18n/recitationLabel";
import type { Player, PlayResult } from "../voice/Player";
import type { PlayerRegistry } from "../voice/PlayerRegistry";
import type { Recitation } from "../voice/Recitation";
import { createPanel, hasPanel } from "./playerPanel";

const logger = createLogger("PlaybackRequest");

const PICKER_CUSTOM_ID_PREFIX = "rewayah-play:";

/**
 * Everything a caller hands the module for one interaction path. The reply
 * sinks are plain functions so tests drive the whole lifecycle with recorded
 * object literals instead of Discord interaction mocks.
 */
export interface PlayRequestInput {
	guildId: string;
	catalog: Catalog;
	surah: Surah;
	reciter?: string;
	locale: Locale;
	translator: Localizable;
	voiceChannel: VoiceChannel;
	noticeChannel?: TextBasedChannel;
	/** Discord user id who requested the Recitation. */
	requestedBy?: string;
	editReply(reply: PlayReply): Promise<unknown>;
	/**
	 * Delivers the picker's timeout notices and auto-play announcement, and
	 * overflow picker containers when the choice list exceeds the 40-component
	 * limit (sent as a follow-up with the same Section design as the first
	 * container, per user request to keep the old design).
	 */
	followUp(content: string | PlayReply): Promise<unknown>;
}

export interface RewayahPickInput {
	guildId: string;
	catalog: Catalog;
	/** The pressed button's customId; parsed by the module itself. */
	customId: string;
	locale: Locale;
	translator: Localizable;
	noticeChannel?: TextBasedChannel;
	/** Discord user id who pressed the picker button. */
	requestedBy?: string;
	editReply(reply: PlayReply): Promise<unknown>;
}

export interface RadioConfirmInput {
	guildId: string;
	locale: Locale;
	translator: Localizable;
	noticeChannel?: TextBasedChannel;
	/** Replies ephemerally when there is no in-place prompt to update. */
	replyEphemeral(content: string): Promise<unknown>;
	/** Updates the radio-confirm prompt message in place. */
	update(reply: PlayReply): Promise<unknown>;
}

/** A ready-to-post reply payload: text plus (usually cleared) components. */
export interface PlayReply {
	content: string;
	components: Array<ActionRowBuilder<ButtonBuilder> | ContainerBuilder>;
	flags?: number;
}

/**
 * The deep module behind the `/play` seam. Owns the full PlayOutcome
 * lifecycle for a guild — Reciter/Rewayah fallback resolution, the
 * RewayahPicker session lifecycle, pending-Radio confirmations, and the
 * notice-channel / PlayerPanel side-effects — behind four narrow calls:
 * `request`, `pickRewayah`, `confirmRadio`, `cancelRadio`. Callers hand in
 * reply sinks and never branch on the outcome themselves.
 */
export class PlaybackRequest {
	private readonly pickers = new Map<string, ActivePicker>();
	private readonly pendingRecitation = new Map<string, Recitation>();
	private readonly wired = new WeakSet<Player>();

	constructor(
		private readonly deps: {
			players: Pick<PlayerRegistry, "get" | "getOrCreate">;
			guildConfig: GuildConfig;
			defaults: GlobalDefaults;
			pickerTimeoutMs: number;
		},
	) {}

	/**
	 * Wires a Player's user-facing side-effects once at creation: playback
	 * notices route to the session's notice channel, the first playback start
	 * auto-posts the guild's PlayerPanel there, and session end drops any
	 * pending Radio confirmation. Called by the composition root's player
	 * factory.
	 */
	attach(player: Player, locale: Locale) {
		if (this.wired.has(player)) return;
		this.wired.add(player);

		player.onEnd(() => this.pendingRecitation.delete(player.guildId));

		// Any Radio transition (a new station starting, a stop, session end)
		// invalidates an outstanding play confirmation for that station.
		player.onRadioChange(() => this.pendingRecitation.delete(player.guildId));

		player.onNotice((message) => {
			const channel = player.noticeChannel;

			if (!channel || !("send" in channel)) return;

			void channel.send(message).catch((error: unknown) => {
				logger.error(
					error,
					"Failed to post notice in guild %s",
					player.guildId,
				);
			});
		});

		let posting = false;

		player.onChange(() => {
			if (posting || !player.isPlaying || hasPanel(player.guildId)) return;

			const channel = player.noticeChannel;

			if (!channel || !("send" in channel)) return;

			posting = true;

			void createPanel(player, channel, locale).catch((error: unknown) => {
				logger.error(error, "Failed to post panel in guild %s", player.guildId);
				posting = false;
			});
		});
	}

	/**
	 * Full `/play` lifecycle: resolve Reciter > GuildConfig > global default
	 * and its Rewayat, then either play directly, show the RewayahPicker, or
	 * ask for confirmation while a Radio plays — replying through the given
	 * sink whichever way it goes.
	 */
	async request(input: PlayRequestInput): Promise<void> {
		const outcome = await this.resolvePlay(
			input.catalog,
			input.guildId,
			input.surah,
			input.reciter,
			input.locale,
			input.requestedBy,
		);

		if (outcome.kind === "error") {
			await input.editReply({ content: outcome.message, components: [] });
			return;
		}

		const player = this.deps.players.getOrCreate(input.guildId);
		await player.join(input.voiceChannel);
		this.setNoticeChannel(player, input.noticeChannel);

		if (outcome.kind === "picker") {
			this.startPickerSession(input, player, outcome);
			const reply = renderPicker(outcome);
			// Keep the old Section design. If the picker exceeds Discord's
			// 40-component limit, send the first container in the deferred
			// reply and each overflow container as a follow-up — same design
			// as the second container, per user request.
			if (reply.components.length <= 1) {
				await input.editReply(reply);
			} else {
				const [first, ...rest] = reply.components;
				await input.editReply({
					content: "",
					components: [first],
					flags: MessageFlags.IsComponentsV2,
				});
				for (const component of rest) {
					// SAFETY: followUp is typed as string|PlayReply for overflow; this is the PlayReply branch
					await input.followUp({
						content: "",
						components: [component],
						flags: MessageFlags.IsComponentsV2,
					} as PlayReply);
				}
			}
			return;
		}

		await this.playOrConfirm(player, outcome.recitation, input.locale, {
			edit: (reply) => input.editReply(reply),
		});
	}

	/**
	 * A RewayahPicker Play press: settles that guild's picker (cancelling its
	 * timeout), resolves the chosen RewayahChoice into a full Recitation, then
	 * plays it — or asks for confirmation while a Radio plays.
	 */
	async pickRewayah(input: RewayahPickInput): Promise<void> {
		const parsed = parsePickerCustomId(input.customId);

		if (!parsed) return;

		// A press resolves the picker and cancels its timer.
		this.pickers.get(input.guildId)?.press();

		const player = this.deps.players.get(input.guildId);

		if (!player?.isConnected) {
			await input.editReply(
				pickerTextReply(input.translator.t("command.notConnected")),
			);
			return;
		}

		const recitation = await buildRecitationFromChoice(
			input.catalog,
			{
				surahNumber: parsed.surahNumber,
				reciterId: parsed.reciterId,
				reciterName: "",
				rewayahId: parsed.rewayahId,
				rewayahName: "",
			},
			input.locale,
			input.requestedBy,
		).catch(() => undefined);

		if (!recitation) {
			await input.editReply(
				pickerTextReply(input.translator.t("command.resolveFailed")),
			);
			return;
		}

		this.setNoticeChannel(player, input.noticeChannel);

		await this.playOrConfirm(player, recitation, input.locale, {
			edit: (reply) => input.editReply(toPickerEditReply(reply)),
		});
	}

	/** The confirm press on a radio-confirm prompt: stops the Radio, plays the pending Recitation. */
	async confirmRadio(input: RadioConfirmInput): Promise<void> {
		const player = await this.requirePlayer(input);

		if (!player) return;

		const pending = this.takePendingRecitation(input.guildId);

		if (!pending) {
			await input.replyEphemeral(input.translator.t("command.resolveFailed"));
			return;
		}

		player.stopRadio();

		this.setNoticeChannel(player, input.noticeChannel);

		try {
			const result = await player.play(pending);
			await input.update({
				content: formatPlayResult(pending, result, input.locale),
				components: [],
			});
		} catch (error) {
			logger.error(
				error,
				"Radio confirm play failed in guild %s",
				input.guildId,
			);
			await input.update({
				content: input.translator.t("command.resolveFailed"),
				components: [],
			});
		}
	}

	/** The cancel press on a radio-confirm prompt: keeps the Radio playing. */
	async cancelRadio(input: RadioConfirmInput): Promise<void> {
		const player = await this.requirePlayer(input);

		if (!player) return;

		this.pendingRecitation.delete(input.guildId);
		const station = player.radioInfo?.name ?? "radio";

		try {
			await input.update({
				content: input.translator.t("command.radioContinuing", { station }),
				components: [],
			});
		} catch (error) {
			logger.error(
				error,
				"Radio cancel update failed in guild %s",
				input.guildId,
			);
		}
	}

	private takePendingRecitation(guildId: string) {
		const pending = this.pendingRecitation.get(guildId);
		this.pendingRecitation.delete(guildId);
		return pending;
	}

	/** Non-mutating look at the guild's pending Radio confirmation (for gating). */
	peekPendingRecitation(guildId: string): Recitation | undefined {
		return this.pendingRecitation.get(guildId);
	}

	private setNoticeChannel(player: Player, noticeChannel?: TextBasedChannel) {
		if (noticeChannel) player.setNoticeChannel(noticeChannel);
	}

	/** Fetches the guild's Player, replying ephemerally when there is none. */
	private async requirePlayer(input: RadioConfirmInput) {
		const player = this.deps.players.get(input.guildId);

		if (!player) {
			await input.replyEphemeral(input.translator.t("command.notConnected"));
		}

		return player;
	}

	/** Plays the Recitation, or parks it as a pending Radio confirmation. */
	private async playOrConfirm(
		player: Player,
		recitation: Recitation,
		locale: Locale,
		sink: { edit: (reply: PlayReply) => Promise<unknown> },
	) {
		if (player.isRadioPlaying) {
			this.pendingRecitation.set(player.guildId, recitation);
			await sink.edit(radioConfirmPrompt(player, recitation, locale));
			return;
		}

		const result = await player.play(recitation);

		await sink.edit({
			content: formatPlayResult(recitation, result, locale),
			components: [],
		});
	}

	private startPickerSession(
		input: PlayRequestInput,
		player: Player,
		outcome: PickerOutcome,
	) {
		this.pickers.get(input.guildId)?.dispose();

		const picker = new ActivePicker({
			timeoutMs: this.deps.pickerTimeoutMs,
			defaultChoice: outcome.defaultChoice,
			catalog: input.catalog,
			player,
			locale: outcome.locale,
			requestedBy: input.requestedBy,
			followUp: input.followUp,
			onSettle: () => {
				if (this.pickers.get(input.guildId) === picker) {
					this.pickers.delete(input.guildId);
				}
			},
		});

		this.pickers.set(input.guildId, picker);
	}

	/**
	 * Resolves which Reciter plays the given Surah (option > GuildConfig >
	 * global default), and whether that resolves to a single Recitation
	 * (play it directly) or to a real Rewayah choice (show the picker).
	 * The Catalog is expected to be bound to the requesting locale, so
	 * Reciter/Rewayah names come back localized.
	 */
	private async resolvePlay(
		catalog: Catalog,
		guildId: string,
		surah: Surah,
		reciterOption?: string,
		locale: Locale = DEFAULT_LOCALE,
		requestedBy?: string,
	): Promise<PlayOutcome> {
		const { t } = localizable(locale);
		let reciterId: number | undefined;

		if (reciterOption) {
			const reciter = await catalog.resolveReciterByName(reciterOption);

			if (!reciter) {
				return {
					kind: "error",
					message: t("command.reciterNotFound", { reciter: reciterOption }),
				};
			}

			reciterId = reciter.id;
		}

		const rewayahCovers: RewayahCoverage = async (
			rId,
			surahNumber,
			rewayahId,
		) => {
			const rewayat = await catalog.resolveRewayat(rId, surahNumber);

			return rewayat.some((r) => r.id === rewayahId);
		};

		const resolved = await this.deps.guildConfig.resolve(
			guildId,
			{
				surahNumber: surah.number,
				option: reciterId !== undefined ? { reciter: reciterId } : {},
			},
			rewayahCovers,
		);

		// reciter
		if (resolved.reciter === undefined) {
			return {
				kind: "error",
				message: t("command.noDefaultReciter"),
			};
		}

		const reciter = await catalog.resolveReciterById(resolved.reciter);

		if (!reciter) {
			return { kind: "error", message: t("command.reciterMissing") };
		}

		// rewayah
		const rewayat = await catalog.resolveRewayat(reciter.id, surah.number);

		if (rewayat.length === 0) {
			return {
				kind: "error",
				message: t("command.noRecitation", {
					reciter: reciter.name,
					surah: surah.name,
					number: String(surah.number),
				}),
			};
		}

		const guildData = this.deps.guildConfig.get(guildId);
		const configuredRewayah =
			guildData?.defaultRewayah ?? this.deps.defaults.defaultRewayah;
		const defaultDoesNotCover =
			configuredRewayah !== undefined && resolved.rewayah === undefined;

		const toChoice = (rewayah: Rewayah): RewayahChoice => ({
			surahNumber: surah.number,
			reciterId: reciter.id,
			reciterName: reciter.name,
			rewayahId: rewayah.id,
			rewayahName: rewayah.name,
		});

		const defaultChoice = resolved.rewayah
			? rewayat.find((r) => r.id === resolved.rewayah)
			: undefined;

		if (rewayat.length > 1 || defaultDoesNotCover) {
			return {
				kind: "picker",
				surah,
				reciterName: reciter.name,
				choices: rewayat.map(toChoice),
				defaultChoice: defaultChoice ? toChoice(defaultChoice) : undefined,
				locale,
			};
		}

		const rewayah = defaultChoice ?? rewayat[0];
		const url = await catalog.resolveStreamUrl(
			reciter.id,
			rewayah.id,
			surah.number,
		);

		if (!url) {
			return {
				kind: "error",
				message: t("command.noStream", {
					surah: surah.name,
					reciter: reciter.name,
					rewayah: rewayah.name,
				}),
			};
		}

		return {
			kind: "play",
			recitation: {
				surah,
				reciterId: reciter.id,
				reciterName: reciter.name,
				rewayahId: rewayah.id,
				rewayahName: rewayah.name,
				url,
				...(requestedBy ? { requestedBy } : {}),
			},
		};
	}
}

export interface RewayahChoice {
	surahNumber: number;
	reciterId: number;
	reciterName: string;
	rewayahId: number;
	rewayahName: string;
}

type PlayOutcome =
	| { kind: "play"; recitation: Recitation }
	| PickerOutcome
	| { kind: "error"; message: string };

interface PickerOutcome {
	kind: "picker";
	surah: Surah;
	reciterName: string;
	choices: RewayahChoice[];
	/** The resolved default Rewayah to auto-play on picker timeout, if any. */
	defaultChoice: RewayahChoice | undefined;
	/** The locale the picker's labels render in. */
	locale: Locale;
}

/**
 * Turns a 'picker' choice into a full Recitation (resolving the stream URL
 * through the Catalog) at the moment playback actually starts. The Catalog is
 * expected to be bound to the picker's locale; `locale` localizes the error.
 */
async function buildRecitationFromChoice(
	catalog: Catalog,
	choice: RewayahChoice,
	locale: Locale = DEFAULT_LOCALE,
	requestedBy?: string,
): Promise<Recitation> {
	const surah = catalog.resolveSurah(choice.surahNumber);
	const reciter = await catalog.resolveReciterById(choice.reciterId);
	const rewayah = reciter?.rewayat.find((r) => r.id === choice.rewayahId);
	const url = await catalog.resolveStreamUrl(
		choice.reciterId,
		choice.rewayahId,
		choice.surahNumber,
	);

	if (!surah || !reciter || !rewayah || !url) {
		const { t } = localizable(locale);
		throw new Error(
			t("command.resolveStreamFailed", {
				number: String(choice.surahNumber),
			}),
		);
	}

	return {
		surah,
		reciterId: reciter.id,
		reciterName: reciter.name,
		rewayahId: rewayah.id,
		rewayahName: rewayah.name,
		url,
		...(requestedBy ? { requestedBy } : {}),
	};
}

export function pickerCustomId(choice: RewayahChoice): string {
	return `${PICKER_CUSTOM_ID_PREFIX}${choice.surahNumber}:${choice.reciterId}:${choice.rewayahId}`;
}

export function parsePickerCustomId(
	customId: string,
): { surahNumber: number; reciterId: number; rewayahId: number } | undefined {
	if (!customId.startsWith(PICKER_CUSTOM_ID_PREFIX)) return undefined;

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

interface PickerRenderOptions {
	surah: Surah;
	reciterName: string;
	choices: RewayahChoice[];
	locale?: Locale;
}

function renderPicker(options: PickerRenderOptions): PlayReply {
	const locale = options.locale ?? DEFAULT_LOCALE;
	const { t } = localizable(locale);
	const surah = surahName(options.surah, locale);

	const header = new TextDisplayBuilder().setContent(
		`-# ${t("picker.header", { surah, reciter: options.reciterName })}`,
	);

	const gallery = new MediaGalleryBuilder().addItems(
		new MediaGalleryItemBuilder()
			.setURL(`https://qurantv.fr/images/surat/${options.surah.number}.png`)
			.setDescription(surah),
	);

	const sections = options.choices.map((choice) =>
		new SectionBuilder()
			.addTextDisplayComponents(
				new TextDisplayBuilder().setContent(choice.rewayahName),
			)
			.setButtonAccessory(
				new ButtonBuilder()
					.setCustomId(pickerCustomId(choice))
					.setLabel("Play")
					.setStyle(ButtonStyle.Success)
					.setEmoji(t("emote.picker")),
			),
	);

	const FIRST_CONTAINER_MAX_ROWS = 7;
	const firstSections = sections.slice(0, FIRST_CONTAINER_MAX_ROWS);
	const overflowSections = sections.slice(FIRST_CONTAINER_MAX_ROWS);

	const firstContainer = new ContainerBuilder()
		.addMediaGalleryComponents(gallery)
		.addTextDisplayComponents(header)
		.addSeparatorComponents(new SeparatorBuilder())
		.addSectionComponents(...firstSections);

	const components: Array<ContainerBuilder | ActionRowBuilder<ButtonBuilder>> =
		[firstContainer];

	if (overflowSections.length > 0) {
		const MAX_ROWS_PER_OVERFLOW_CONTAINER = 10;

		for (
			let i = 0;
			i < overflowSections.length;
			i += MAX_ROWS_PER_OVERFLOW_CONTAINER
		) {
			const chunk = overflowSections.slice(
				i,
				i + MAX_ROWS_PER_OVERFLOW_CONTAINER,
			);
			const overflowContainer = new ContainerBuilder().addSectionComponents(
				...chunk,
			);
			components.push(overflowContainer);
		}
	}

	return {
		content: "",
		components,
		flags: MessageFlags.IsComponentsV2,
	};
}

/**
 * Builds the radio-confirm prompt for a Recitation requested while a Radio
 * plays: it parks the Recitation as pending and asks whether to interrupt.
 */
function radioConfirmPrompt(
	player: Player,
	recitation: Recitation,
	locale: Locale,
): PlayReply {
	const translator = localizable(locale);
	const station = player.radioInfo?.name ?? "radio";
	const label = recitationLabel(recitation, locale);
	const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
		new ButtonBuilder()
			.setCustomId("radio:confirm")
			.setLabel(translator.t("command.radioConfirmYes"))
			.setStyle(ButtonStyle.Success),
		new ButtonBuilder()
			.setCustomId("radio:cancel")
			.setLabel(translator.t("command.radioConfirmNo"))
			.setStyle(ButtonStyle.Secondary),
	);

	return {
		content: translator.t("command.radioConfirmPrompt", { station, label }),
		components: [row],
	};
}

/**
 * The single user-facing wording for the outcome of playing a Recitation,
 * shared by the direct `/play` path, the picker button, and the picker
 * timeout, so the feedback is identical however playback starts. Rendered in
 * the requesting locale from the message catalog.
 */
function formatPlayResult(
	recitation: Recitation,
	result: PlayResult,
	locale: Locale = DEFAULT_LOCALE,
): string {
	const { t } = localizable(locale);
	const label = recitationLabel(recitation, locale);

	if (result.queued) return t("play.addedToQueue", { label });
	if (result.started) return t("play.started", { label });

	return t("play.failed", { surah: surahName(recitation.surah, locale) });
}

function pickerTextReply(text: string): PlayReply {
	return {
		content: "",
		components: [
			new ContainerBuilder().addTextDisplayComponents(
				new TextDisplayBuilder().setContent(text),
			),
		],
		flags: MessageFlags.IsComponentsV2,
	};
}

function toPickerEditReply(reply: PlayReply): PlayReply {
	if (reply.flags === MessageFlags.IsComponentsV2) return reply;

	if (reply.components.length > 0) {
		const rows = reply.components as ActionRowBuilder<ButtonBuilder>[];
		return {
			content: "",
			components: [
				new ContainerBuilder()
					.addTextDisplayComponents(
						new TextDisplayBuilder().setContent(reply.content),
					)
					.addActionRowComponents(...rows),
			],
			flags: MessageFlags.IsComponentsV2,
		};
	}

	return pickerTextReply(reply.content);
}

interface ActivePickerOptions {
	timeoutMs: number;
	defaultChoice: RewayahChoice | undefined;
	catalog: Catalog;
	player: Player;
	requestedBy?: string;
	followUp: (content: string) => Promise<unknown>;
	locale?: Locale;
	onSettle: () => void;
}

/**
 * One picker's whole lifecycle, owned by the module: its timeout timer, its
 * resolution on a button press, and its follow-up auto-play. Keyed per guild
 * inside the module rather than by message id.
 */
class ActivePicker {
	private timer: NodeJS.Timeout | null = null;
	private settled = false;

	constructor(private readonly options: ActivePickerOptions) {
		this.arm();
	}

	private arm() {
		if (this.settled || this.timer) return;

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
		this.disposeTimer();
		this.settle();
	}

	/**
	 * Fires the picker's timeout: auto-plays the resolved default Rewayah, or
	 * posts the "nothing picked" notice when there is no default. Settles the
	 * picker exactly once.
	 */
	async timeout() {
		if (this.settled) return;

		this.settle();

		const locale = this.options.locale ?? DEFAULT_LOCALE;

		if (!this.options.defaultChoice) {
			const { t } = localizable(locale);
			await this.options.followUp(t("picker.timeoutNoDefault"));
			return;
		}

		const recitation = await buildRecitationFromChoice(
			this.options.catalog,
			this.options.defaultChoice,
			locale,
			this.options.requestedBy,
		);
		const result = await this.options.player.play(recitation);

		await this.options.followUp(formatPlayResult(recitation, result, locale));
	}

	private settle() {
		if (this.settled) return;
		this.settled = true;
		this.options.onSettle();
	}

	private disposeTimer() {
		if (this.timer) clearTimeout(this.timer);
		this.timer = null;
	}

	dispose() {
		this.disposeTimer();
		this.settle();
	}
}

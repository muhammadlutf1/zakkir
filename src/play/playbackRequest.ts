import type { TextBasedChannel, VoiceChannel } from "discord.js";
import {
	ActionRowBuilder,
	ButtonBuilder,
	ButtonStyle,
	ContainerBuilder,
	MediaGalleryBuilder,
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
/** Base URL for the QuranTV surat preview image used in the picker card. */
const PICKER_IMAGE_BASE = "https://qurantv.fr/images/surat";
/**
 * How many Rewayah sections fit in the first (image-bearing) picker Container.
 * A Discord Container holds at most 10 components; the header TextDisplay, the
 * MediaGallery, and the Separator take three, leaving seven for sections.
 */
const FIRST_CONTAINER_SECTIONS = 7;

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
	/** Delivers the picker's timeout notices, auto-play, or overflow Container. */
	followUp(reply: PlayReply): Promise<unknown>;
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

/**
 * A ready-to-post reply payload. `components` carries either legacy
 * ActionRows (radio-confirm buttons) or Components V2 Containers (the
 * RewayahPicker card); `flags` carries `MessageFlags.IsComponentsV2` for the
 * latter so edits to the same message stay Components V2 compatible.
 */
export interface PlayReply {
	content?: string;
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
	private readonly pendingRecitation = new Map<
		string,
		{ recitation: Recitation; componentsV2: boolean }
	>();
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
			const rendered = renderPicker(outcome);
			await input.editReply(rendered.reply);
			if (rendered.overflow) await input.followUp(rendered.overflow);
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
				v2TextReply(input.translator.t("command.notConnected")),
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
				v2TextReply(input.translator.t("command.resolveFailed")),
			);
			return;
		}

		this.setNoticeChannel(player, input.noticeChannel);

		// The picker message is already Components V2, so every edit to it
		// (success, radio-confirm) must stay Components V2 compatible.
		await this.playOrConfirm(
			player,
			recitation,
			input.locale,
			{
				edit: (reply) => input.editReply(v2EditReply(reply)),
			},
			true,
		);
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

		const v2 = pending.componentsV2;

		try {
			const result = await player.play(pending.recitation);
			const body = formatPlayResult(pending.recitation, result, input.locale);
			await input.update(
				v2 ? v2TextReply(body) : { content: body, components: [] },
			);
		} catch (error) {
			logger.error(
				error,
				"Radio confirm play failed in guild %s",
				input.guildId,
			);
			await input.update(
				v2
					? v2TextReply(input.translator.t("command.resolveFailed"))
					: {
							content: input.translator.t("command.resolveFailed"),
							components: [],
						},
			);
		}
	}

	/** The cancel press on a radio-confirm prompt: keeps the Radio playing. */
	async cancelRadio(input: RadioConfirmInput): Promise<void> {
		const player = await this.requirePlayer(input);

		if (!player) return;

		const pending = this.pendingRecitation.get(input.guildId);
		const v2 = pending?.componentsV2 ?? false;
		this.pendingRecitation.delete(input.guildId);
		const station = player.radioInfo?.name ?? "radio";
		const body = input.translator.t("command.radioContinuing", { station });

		try {
			await input.update(
				v2 ? v2TextReply(body) : { content: body, components: [] },
			);
		} catch (error) {
			logger.error(
				error,
				"Radio cancel update failed in guild %s",
				input.guildId,
			);
		}
	}

	private takePendingRecitation(
		guildId: string,
	): { recitation: Recitation; componentsV2: boolean } | undefined {
		const pending = this.pendingRecitation.get(guildId);
		this.pendingRecitation.delete(guildId);
		return pending;
	}

	/** Non-mutating look at the guild's pending Radio confirmation (for gating). */
	peekPendingRecitation(guildId: string): Recitation | undefined {
		return this.pendingRecitation.get(guildId)?.recitation;
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
		componentsV2 = false,
	) {
		if (player.isRadioPlaying) {
			this.pendingRecitation.set(player.guildId, {
				recitation,
				componentsV2,
			});
			await sink.edit(
				radioConfirmPrompt(player, recitation, locale, componentsV2),
			);
			return;
		}

		const result = await player.play(recitation);

		// The caller decides whether this is a V2 (picker) or legacy (direct
		// /play) edit; a V2 caller wraps the reply via `v2EditReply`.
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

/** A rendered picker: the primary V2 Container, plus an overflow Container. */
interface PickerRender {
	reply: PlayReply;
	overflow?: PlayReply;
}

/**
 * One Rewayah row in the picker: the rewayah name on the left, a green Play
 * button (Success style + `emote.picker`) on the right.
 */
function buildPickerSection(
	choice: RewayahChoice,
	translator: Localizable,
): SectionBuilder {
	return new SectionBuilder()
		.addTextDisplayComponents(
			new TextDisplayBuilder().setContent(choice.rewayahName),
		)
		.setButtonAccessory(
			new ButtonBuilder()
				.setCustomId(pickerCustomId(choice))
				.setLabel(translator.t("picker.playLabel"))
				.setEmoji(translator.t("emote.picker"))
				.setStyle(ButtonStyle.Success),
		);
}

/**
 * Re-skins the RewayahPicker as a single QuranTV dark card: one Container with
 * a localized header, the surat preview image, a separator, and one Section
 * per Rewayah. If the Rewayat overflow a single Container, the remainder go in
 * a follow-up Container (no header/image) — Discord never truncates them.
 */
function renderPicker(options: PickerRenderOptions): PickerRender {
	const locale = options.locale ?? DEFAULT_LOCALE;
	const translator = localizable(locale);
	const surah = surahName(options.surah, locale);
	const number = options.surah.number;

	const header = translator.t("picker.header", {
		surah,
		reciter: options.reciterName,
	});

	const firstChoices = options.choices.slice(0, FIRST_CONTAINER_SECTIONS);
	const restChoices = options.choices.slice(FIRST_CONTAINER_SECTIONS);

	const reply: PlayReply = {
		flags: MessageFlags.IsComponentsV2,
		components: [
			new ContainerBuilder()
				.addTextDisplayComponents(new TextDisplayBuilder().setContent(header))
				.addMediaGalleryComponents(
					new MediaGalleryBuilder().addItems([
						{
							media: { url: `${PICKER_IMAGE_BASE}/${number}.png` },
							description: surah,
						},
					]),
				)
				.addSeparatorComponents(new SeparatorBuilder())
				.addSectionComponents(
					firstChoices.map((choice) => buildPickerSection(choice, translator)),
				),
		],
	};

	if (restChoices.length === 0) return { reply };

	const overflow: PlayReply = {
		flags: MessageFlags.IsComponentsV2,
		components: [
			new ContainerBuilder().addSectionComponents(
				restChoices.map((choice) => buildPickerSection(choice, translator)),
			),
		],
	};

	return { reply, overflow };
}

/**
 * Builds the radio-confirm prompt for a Recitation requested while a Radio
 * plays: it parks the Recitation as pending and asks whether to interrupt.
 * When `componentsV2` is set the prompt is a Components V2 Container (so it
 * can safely edit a Components V2 picker message); otherwise it is a legacy
 * ActionRow of buttons.
 */
function radioConfirmPrompt(
	player: Player,
	recitation: Recitation,
	locale: Locale,
	componentsV2: boolean,
): PlayReply {
	const translator = localizable(locale);
	const station = player.radioInfo?.name ?? "radio";
	const label = recitationLabel(recitation, locale);
	const content = translator.t("command.radioConfirmPrompt", {
		station,
		label,
	});

	const yes = new ButtonBuilder()
		.setCustomId("radio:confirm")
		.setLabel(translator.t("command.radioConfirmYes"))
		.setStyle(ButtonStyle.Success);
	const no = new ButtonBuilder()
		.setCustomId("radio:cancel")
		.setLabel(translator.t("command.radioConfirmNo"))
		.setStyle(ButtonStyle.Secondary);

	if (!componentsV2) {
		return {
			content,
			components: [
				new ActionRowBuilder<ButtonBuilder>().addComponents(yes, no),
			],
		};
	}

	return {
		flags: MessageFlags.IsComponentsV2,
		components: [
			new ContainerBuilder()
				.addTextDisplayComponents(new TextDisplayBuilder().setContent(content))
				.addActionRowComponents(
					new ActionRowBuilder<ButtonBuilder>().addComponents(yes, no),
				),
		],
	};
}

/**
 * A Components V2 text-only reply: the text lives inside a Container
 * TextDisplay because the legacy `content` field is forbidden on a
 * Components V2 message. Used to safely edit the V2 picker message.
 */
function v2TextReply(content: string): PlayReply {
	return {
		content: "",
		components: [
			new ContainerBuilder().addTextDisplayComponents(
				new TextDisplayBuilder().setContent(content),
			),
		],
		flags: MessageFlags.IsComponentsV2,
	};
}

/**
 * Wraps a legacy {@link PlayReply} (content + optional action rows) as a
 * Components V2 payload, so it can edit the V2 picker message. Replies that
 * are already Components V2 (e.g. the radio-confirm prompt) pass through
 * unchanged.
 */
function v2EditReply(reply: PlayReply): PlayReply {
	if (reply.flags === MessageFlags.IsComponentsV2) return reply;

	const container = new ContainerBuilder().addTextDisplayComponents(
		new TextDisplayBuilder().setContent(reply.content ?? ""),
	);

	for (const component of reply.components) {
		if (component instanceof ActionRowBuilder) {
			container.addActionRowComponents(component);
		}
	}

	return {
		content: "",
		components: [container],
		flags: MessageFlags.IsComponentsV2,
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

interface ActivePickerOptions {
	timeoutMs: number;
	defaultChoice: RewayahChoice | undefined;
	catalog: Catalog;
	player: Player;
	requestedBy?: string;
	followUp: (reply: PlayReply) => Promise<unknown>;
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
			await this.options.followUp({
				content: t("picker.timeoutNoDefault"),
				components: [],
			});
			return;
		}

		const recitation = await buildRecitationFromChoice(
			this.options.catalog,
			this.options.defaultChoice,
			locale,
			this.options.requestedBy,
		);
		const result = await this.options.player.play(recitation);

		await this.options.followUp({
			content: formatPlayResult(recitation, result, locale),
			components: [],
		});
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

import assert from "node:assert/strict";
import { describe, it, mock } from "node:test";
import type {
	ActionRowBuilder,
	ButtonBuilder,
	ContainerBuilder,
	VoiceChannel,
} from "discord.js";
import { MessageFlags } from "discord.js";
import type { Catalog, Reciter, Rewayah } from "../../src/catalog/Catalog";
import { resolveSurah } from "../../src/catalog/suwar";
import playCommand from "../../src/commands/play";
import type { CommandContext } from "../../src/core/interactionContext";
import { GuildConfig } from "../../src/guild/GuildConfig";
import { SqliteGuildConfigStore } from "../../src/guild/SqliteGuildConfigStore";
import type { GlobalDefaults } from "../../src/guild/types";
import { localizable } from "../../src/i18n/locale";
import {
	PlaybackRequest,
	type PlayReply,
	parsePickerCustomId,
	pickerCustomId,
} from "../../src/play/playbackRequest";
import { hasPanel } from "../../src/play/playerPanel";
import type { Player } from "../../src/voice/Player";
import type { Recitation } from "../../src/voice/Recitation";

const NO_DEFAULTS: GlobalDefaults = {
	language: "ar",
	defaultReciter: undefined,
	defaultRewayah: undefined,
};

const rewayah = (id: number, name: string, surahs: number[]): Rewayah => ({
	id,
	name,
	server: `https://fixture/mc${id}`,
	surahList: new Set(surahs),
	surahCount: surahs.length,
});

const FIXTURES: Reciter[] = [
	{
		id: 1,
		name: "إبراهيم الأخضر",
		rewayat: [
			rewayah(1, "حفص عن عاصم - مرتل", [18]),
			rewayah(2, "ورش عن نافع - مرتل", [18]),
		],
	},
	{
		id: 10,
		name: "أكرم العلاقمي",
		rewayat: [rewayah(10, "حفص عن عاصم - مرتل", [18])],
	},
	{
		id: 20,
		name: "محمد صديق المنشاوي",
		rewayat: [rewayah(20, "قالون عن نافع - مرتل", [1])],
	},
];

class FakeCatalog {
	constructor(private readonly reciters: Reciter[]) {}

	async resolveReciterByName(name: string) {
		return this.reciters.find((r) => r.name === name);
	}

	async resolveReciterById(id: number) {
		return this.reciters.find((r) => r.id === id);
	}

	async resolveRewayat(reciterId: number, surahNumber: number) {
		const reciter = this.reciters.find((r) => r.id === reciterId);

		return reciter?.rewayat.filter((r) => r.surahList.has(surahNumber)) ?? [];
	}

	async resolveStreamUrl(
		reciterId: number,
		rewayahId: number,
		surahNumber: number,
	) {
		const reciter = this.reciters.find((r) => r.id === reciterId);
		const rewayah = reciter?.rewayat.find(
			(r) => r.id === rewayahId && r.surahList.has(surahNumber),
		);

		return rewayah
			? `${rewayah.server}/${String(surahNumber).padStart(3, "0")}.mp3`
			: undefined;
	}

	resolveSurah(input: string | number) {
		return resolveSurah(input);
	}
}

const catalog = new FakeCatalog(FIXTURES) as unknown as Catalog;
const alKahf = resolveSurah(18)!;

interface PlayerHarness {
	player: Player;
	calls: string[];
	played: Recitation[];
	notices: ((message: string) => void)[];
	changes: (() => void)[];
	ends: (() => void)[];
	radioChanges: (() => void)[];
	setRadio(radioPlaying: boolean): void;
	setConnected(connected: boolean): void;
}

function makePlayer(
	options: {
		guildId?: string;
		playResult?: { started: boolean; queued: boolean };
		isPlaying?: boolean;
	} = {},
): PlayerHarness {
	const calls: string[] = [];
	const played: Recitation[] = [];
	const notices: ((message: string) => void)[] = [];
	const changes: (() => void)[] = [];
	const ends: (() => void)[] = [];
	const radioChanges: (() => void)[] = [];

	let connected = true;
	let radioPlaying = false;

	const player = {
		guildId: options.guildId ?? "g-1",

		get isConnected() {
			return connected;
		},
		get isPlaying() {
			return options.isPlaying ?? false;
		},
		get isRadioPlaying() {
			return radioPlaying;
		},
		get radioInfo() {
			return radioPlaying
				? { id: 7, name: "Quran Radio", url: "https://example.com/radio" }
				: null;
		},

		async join(channel: { id: string }) {
			calls.push(`join:${channel.id}`);
		},
		setNoticeChannel(channel: unknown) {
			calls.push("setNoticeChannel");
			void channel;
		},
		async play(recitation: Recitation) {
			calls.push("play");
			played.push(recitation);
			return options.playResult ?? { started: true, queued: false };
		},
		stopRadio() {
			calls.push("stopRadio");
			radioPlaying = false;
		},
		onNotice(listener: (message: string) => void) {
			notices.push(listener);
			return () => {
				const index = notices.indexOf(listener);
				if (index >= 0) notices.splice(index, 1);
			};
		},
		onChange(listener: () => void) {
			changes.push(listener);
			return () => {
				const index = changes.indexOf(listener);
				if (index >= 0) changes.splice(index, 1);
			};
		},
		onEnd(listener: () => void) {
			ends.push(listener);
			return () => {
				const index = ends.indexOf(listener);
				if (index >= 0) ends.splice(index, 1);
			};
		},
		onRadioChange(listener: () => void) {
			radioChanges.push(listener);
			return () => {
				const index = radioChanges.indexOf(listener);
				if (index >= 0) radioChanges.splice(index, 1);
			};
		},
	} as unknown as Player;

	return {
		player,
		calls,
		played,
		notices,
		changes,
		ends,
		radioChanges,
		setRadio(value: boolean) {
			radioPlaying = value;
		},
		setConnected(value: boolean) {
			connected = value;
		},
	};
}

function memoryStore() {
	return new SqliteGuildConfigStore(":memory:");
}

function guildConfig(defaults: GlobalDefaults = NO_DEFAULTS) {
	return new GuildConfig(memoryStore(), defaults);
}

function makePlayback(
	harness: PlayerHarness | undefined,
	config?: GuildConfig,
) {
	return new PlaybackRequest({
		players: {
			getOrCreate: () => harness!.player,
			get: () => harness?.player,
		},
		guildConfig: config ?? guildConfig(),
		defaults: NO_DEFAULTS,
		pickerTimeoutMs: 100,
	});
}

interface EditRecord {
	content?: string;
	components: Array<ActionRowBuilder<ButtonBuilder> | ContainerBuilder>;
	flags?: number;
}

function makeRequestInput(
	harness: PlayerHarness | undefined,
	overrides: Partial<Parameters<PlaybackRequest["request"]>[0]> = {},
) {
	const edits: EditRecord[] = [];
	const followUps: PlayReply[] = [];
	const siblingEdits: EditRecord[] = [];

	const input = {
		guildId: overrides.guildId ?? harness?.player.guildId ?? "g-1",
		catalog,
		surah: alKahf,
		reciter: overrides.reciter,
		locale: overrides.locale ?? ("en" as const),
		translator: localizable(overrides.locale ?? "en"),
		voiceChannel: { id: "voice-1" } as unknown as VoiceChannel,
		noticeChannel:
			overrides.noticeChannel === undefined
				? ({ id: "text-1" } as never)
				: overrides.noticeChannel,
		editReply: async (reply: EditRecord) => {
			edits.push(reply);
		},
		followUp: async (reply: PlayReply) => {
			followUps.push(reply);
			// Stand-in for the Discord Message interaction.followUp returns;
			// its edit handle drives the linked (overflow) picker message.
			return {
				edit: async (recorderReply: EditRecord) => {
					siblingEdits.push(recorderReply);
				},
			};
		},
	};

	return { input, edits, followUps, siblingEdits };
}

/** The customIds of every button in an edit, in render order (V2 or legacy). */
function buttonIds(edit: EditRecord | undefined): string[] {
	if (!edit) return [];

	const ids: string[] = [];

	const walk = (node: unknown) => {
		if (!node || typeof node !== "object") return;
		const record = node as Record<string, unknown>;
		if (typeof record.custom_id === "string") ids.push(record.custom_id);
		if (Array.isArray(record.components)) {
			for (const child of record.components) walk(child);
		}
		if (record.accessory && typeof record.accessory === "object") {
			walk(record.accessory);
		}
		if (Array.isArray(record.items)) {
			for (const child of record.items) walk(child);
		}
	};

	for (const component of edit.components) {
		const json =
			typeof (component as { toJSON?: () => unknown }).toJSON === "function"
				? (component as { toJSON: () => unknown }).toJSON()
				: component;
		walk(json);
	}

	return ids;
}

/** The first (and only) top-level Container in a Components V2 edit. */
function containerOf(edit: EditRecord) {
	const component = edit.components[0] as { toJSON?: () => unknown };
	const json =
		typeof component.toJSON === "function"
			? (component.toJSON() as Record<string, unknown>)
			: (component as unknown as Record<string, unknown>);
	return json;
}

function flatten(node: unknown, out: Record<string, unknown>[] = []): void {
	if (!node || typeof node !== "object") return;
	out.push(node as Record<string, unknown>);
	if (Array.isArray((node as Record<string, unknown>).components)) {
		for (const child of (node as Record<string, unknown>)
			.components as unknown[]) {
			flatten(child, out);
		}
	}
}

function componentTypes(container: Record<string, unknown>): number[] {
	const top =
		(container.components as Record<string, unknown>[] | undefined) ?? [];
	return top.map((c) => c.type as number);
}

function textContents(container: Record<string, unknown>): string[] {
	const all: Record<string, unknown>[] = [];
	flatten(container, all);
	return all
		.filter((c) => c.type === 10 && typeof c.content === "string")
		.map((c) => c.content as string);
}

function mediaGalleryUrls(container: Record<string, unknown>): string[] {
	const all: Record<string, unknown>[] = [];
	flatten(container, all);
	const urls: string[] = [];
	for (const c of all) {
		if (c.type === 12 && Array.isArray(c.items)) {
			for (const item of c.items as Record<string, unknown>[]) {
				const media = item.media as Record<string, string> | undefined;
				if (media?.url) urls.push(media.url);
			}
		}
	}
	return urls;
}

function flush() {
	return new Promise<void>((resolve) => setImmediate(resolve));
}

describe("PlaybackRequest — direct play", () => {
	it("plays a resolved Recitation directly and reports the formatted result", async () => {
		const harness = makePlayer();
		const playback = makePlayback(harness);
		const { input, edits } = makeRequestInput(harness, {
			reciter: "أكرم العلاقمي",
		});

		await playback.request(input);

		assert.equal(edits.length, 1);
		assert.equal(
			edits[0]!.content!,
			"**<:play:1384273884622229514> Playing** Al-Kahf by أكرم العلاقمي (حفص عن عاصم - مرتل).",
		);
		assert.deepEqual(edits[0]!.components, []);
		assert.deepEqual(harness.played[0], {
			surah: alKahf,
			reciterId: 10,
			reciterName: "أكرم العلاقمي",
			rewayahId: 10,
			rewayahName: "حفص عن عاصم - مرتل",
			url: "https://fixture/mc10/018.mp3",
		});
		assert.deepEqual(harness.calls, [
			"join:voice-1",
			"setNoticeChannel",
			"play",
		]);
	});

	it("resolves the Reciter through the guild config and global defaults", async () => {
		for (const defaults of [
			NO_DEFAULTS,
			{
				language: "ar",
				defaultReciter: 10,
				defaultRewayah: 10,
			} as GlobalDefaults,
		]) {
			const store = memoryStore();
			store.set({
				guildId: "g-1",
				language: "ar",
				defaultReciter: 10,
				defaultRewayah: 10,
			});
			const config = new GuildConfig(store, defaults);
			const harness = makePlayer();

			await makePlayback(harness, config).request(
				makeRequestInput(harness).input,
			);

			assert.equal(harness.played[0]?.reciterId, 10);
		}
	});

	it("announces a queued Recitation when one is already playing", async () => {
		const harness = makePlayer({
			playResult: { started: false, queued: true },
		});
		const playback = makePlayback(harness);
		const { input, edits } = makeRequestInput(harness, {
			reciter: "أكرم العلاقمي",
		});

		await playback.request(input);

		assert.equal(
			edits[0]!.content!,
			"✅ Added **Al-Kahf by أكرم العلاقمي (حفص عن عاصم - مرتل)** to the queue.",
		);
	});

	it("reports a failed play with the notice-channel wording", async () => {
		const harness = makePlayer({
			playResult: { started: false, queued: false },
		});
		const playback = makePlayback(harness);
		const { input, edits } = makeRequestInput(harness, {
			reciter: "أكرم العلاقمي",
		});

		await playback.request(input);

		assert.match(edits[0]!.content!, /Couldn't play Al-Kahf/);
	});

	it("renders announcements in the requesting locale", async () => {
		const harness = makePlayer();
		const playback = makePlayback(harness);
		const { input, edits } = makeRequestInput(harness, {
			reciter: "أكرم العلاقمي",
			locale: "ar",
		});

		await playback.request(input);

		assert.match(edits[0]!.content!, /جارٍ تشغيل/);
	});
});

describe("PlaybackRequest — resolution errors", () => {
	it("returns an error when no reciter resolves anywhere", async () => {
		const harness = makePlayer();
		const playback = makePlayback(harness);
		const { input, edits } = makeRequestInput(harness);

		await playback.request(input);

		assert.match(edits[0]!.content!, /default reciter/);
		assert.deepEqual(harness.calls, []);
	});

	it("returns an error when the reciter option is unknown", async () => {
		const harness = makePlayer();
		const playback = makePlayback(harness);
		const { input, edits } = makeRequestInput(harness, {
			reciter: "أبو العيون",
		});

		await playback.request(input);

		assert.match(edits[0]!.content!, /not found|أبو العيون/);
	});

	it("returns an error when no Rewayah covers the Surah for the Reciter", async () => {
		const harness = makePlayer();
		const playback = makePlayback(harness);
		const { input, edits } = makeRequestInput(harness, {
			reciter: "محمد صديق المنشاوي",
		});

		await playback.request(input);

		assert.match(edits[0]!.content!, /no recitation/);
	});
});

describe("PlaybackRequest — RewayahPicker branch", () => {
	function storeWithReciter(reciter: number, rewayah?: number) {
		const store = memoryStore();
		store.set({
			guildId: "g-1",
			language: "ar",
			defaultReciter: reciter,
			defaultRewayah: rewayah,
		});
		return store;
	}

	it("shows the picker as a single Components V2 Container with header, image, and one section per Rewayah", async () => {
		const harness = makePlayer();
		const config = new GuildConfig(storeWithReciter(1, 1));
		const playback = makePlayback(harness, config);
		const { input, edits } = makeRequestInput(harness);

		await playback.request(input);

		assert.deepEqual(harness.calls, ["join:voice-1", "setNoticeChannel"]);
		assert.equal(edits.length, 1);
		assert.equal(edits[0]!.flags, MessageFlags.IsComponentsV2);
		assert.equal(edits[0]!.content!, undefined);

		const container = containerOf(edits[0]!);
		// MediaGallery, header TextDisplay, Separator, then two Sections.
		assert.deepEqual(componentTypes(container), [12, 10, 14, 9, 9]);
		assert.ok(
			mediaGalleryUrls(container).includes(
				"https://qurantv.fr/images/surat/18.png",
			),
		);
		assert.ok(
			textContents(container).some((text) =>
				text.includes(
					"Available riwayat for Surah **Al-Kahf** by **إبراهيم الأخضر**",
				),
			),
		);
		assert.deepEqual(buttonIds(edits[0]), [
			"rewayah-play:18:1:1",
			"rewayah-play:18:1:2",
		]);
	});

	it("shows the picker when the default Rewayah does not cover", async () => {
		const harness = makePlayer();
		const config = new GuildConfig(storeWithReciter(10, 99));
		const playback = makePlayback(harness, config);
		const { input, edits } = makeRequestInput(harness);

		await playback.request(input);

		assert.equal(edits[0]!.flags, MessageFlags.IsComponentsV2);
		assert.deepEqual(buttonIds(edits[0]), ["rewayah-play:18:10:10"]);
	});

	it("prefers the command reciter option over the guild default", async () => {
		const harness = makePlayer();
		const config = new GuildConfig(storeWithReciter(10, 10));
		const playback = makePlayback(harness, config);
		const { input, edits } = makeRequestInput(harness, {
			reciter: "إبراهيم الأخضر",
		});

		await playback.request(input);

		const container = containerOf(edits[0]!);
		assert.ok(
			textContents(container).some((text) => text.includes("إبراهيم الأخضر")),
		);
	});

	it("overflows extra Rewayat into a follow-up Components V2 Container", async () => {
		const many: Reciter = {
			id: 3,
			name: "متعدد الروايات",
			rewayat: Array.from({ length: 12 }, (_, i) =>
				rewayah(i + 100, `riwayat-${i}`, [18]),
			),
		};
		const wideCatalog = new FakeCatalog([many]) as unknown as Catalog;
		const harness = makePlayer();
		const playback = makePlayback(harness);
		const { input, edits, followUps } = makeRequestInput(harness, {
			reciter: many.name,
		});
		input.catalog = wideCatalog;

		await playback.request(input);

		assert.equal(edits.length, 1);
		assert.equal(edits[0]!.flags, MessageFlags.IsComponentsV2);
		// First Container holds the image + 7 sections; the rest overflow.
		assert.equal(buttonIds(edits[0]).length, 7);
		assert.equal(followUps.length, 1);
		assert.equal(followUps[0]!.flags, MessageFlags.IsComponentsV2);
		assert.equal(buttonIds(followUps[0]).length, 5);
		// The overflow Container carries no header image.
		assert.deepEqual(mediaGalleryUrls(containerOf(followUps[0]!)), []);
	});

	it("pickRewayah resolves the pressed choice, cancels the timeout, and plays", async () => {
		mock.timers.enable({ apis: ["setTimeout"] });

		try {
			const harness = makePlayer();
			const config = new GuildConfig(storeWithReciter(1, 1));
			const playback = makePlayback(harness, config);
			const { input, edits, followUps } = makeRequestInput(harness);

			await playback.request(input);
			assert.deepEqual(harness.calls, ["join:voice-1", "setNoticeChannel"]);

			const customId = buttonIds(edits[0])[1]!;
			assert.deepEqual(parsePickerCustomId(customId), {
				surahNumber: 18,
				reciterId: 1,
				rewayahId: 2,
			});

			await playback.pickRewayah({
				guildId: "g-1",
				catalog,
				customId,
				locale: "en",
				translator: localizable("en"),
			});

			assert.equal(harness.played[0]?.rewayahId, 2);
			assert.deepEqual(harness.calls, [
				"join:voice-1",
				"setNoticeChannel",
				"play",
			]);
			const resultText = textContents(containerOf(edits[1]!));
			assert.ok(
				resultText.some((text) =>
					/\*\*<:play:1384273884622229514> Playing\*\* Al-Kahf/.test(text),
				),
			);
			// The success edit keeps the Components V2 flag (edits the picker).
			assert.equal(edits[1]!.flags, MessageFlags.IsComponentsV2);

			// The settled picker's timeout never fires.
			mock.timers.tick(500);
			await flush();
			assert.deepEqual(followUps, []);
		} finally {
			mock.timers.reset();
		}
	});

	it("pickRewayah replies notConnected when no Player is in voice", async () => {
		const harness = makePlayer();
		const config = new GuildConfig(storeWithReciter(1, 1));
		const playback = makePlayback(harness, config);
		const { input, edits } = makeRequestInput(harness);

		await playback.request(input);

		harness.setConnected(false);

		await playback.pickRewayah({
			guildId: "g-1",
			catalog,
			customId: buttonIds(edits[0])[0]!,
			locale: "en",
			translator: localizable("en"),
		});

		assert.ok(
			textContents(containerOf(edits[1]!)).some((text) =>
				/not connected to a voice channel/.test(text),
			),
		);
		assert.equal(edits[1]!.flags, MessageFlags.IsComponentsV2);
		assert.deepEqual(harness.calls, ["join:voice-1", "setNoticeChannel"]);
	});

	it("resolving a pick also resolves the linked overflow message", async () => {
		const many: Reciter = {
			id: 3,
			name: "متعدد الروايات",
			rewayat: Array.from({ length: 12 }, (_, i) =>
				rewayah(i + 100, `riwayat-${i}`, [18]),
			),
		};
		const wideCatalog = new FakeCatalog([many]) as unknown as Catalog;
		const harness = makePlayer();
		const playback = makePlayback(harness);
		const { input, edits, followUps, siblingEdits } = makeRequestInput(
			harness,
			{
				reciter: many.name,
			},
		);
		input.catalog = wideCatalog;

		await playback.request(input);
		assert.equal(followUps.length, 1); // overflow Container posted

		const customId = buttonIds(edits[0])[2]!; // a primary-message button
		await playback.pickRewayah({
			guildId: "g-1",
			catalog: wideCatalog,
			customId,
			locale: "en",
			translator: localizable("en"),
		});

		// The pressed primary message resolves...
		const primaryText = textContents(containerOf(edits[1]!));
		assert.ok(
			primaryText.some((text) => /Playing/.test(text)),
			"primary message should show the play result",
		);
		// ...and so does the linked overflow message (same content).
		const siblingText = textContents(containerOf(siblingEdits[0]!));
		assert.ok(
			siblingText.some((text) => /Playing/.test(text)),
			"sibling overflow message should mirror the play result",
		);
	});

	it("the picker timeout auto-plays the default Rewayah", async () => {
		mock.timers.enable({ apis: ["setTimeout"] });

		try {
			const harness = makePlayer();
			const config = new GuildConfig(storeWithReciter(1, 1));
			const playback = makePlayback(harness, config);
			const { input, edits, followUps } = makeRequestInput(harness);

			await playback.request(input);

			mock.timers.tick(101);
			await flush();
			mock.timers.tick(200);
			await flush();

			assert.equal(harness.played[0]?.rewayahId, 1);
			assert.match(followUps[0]!.content!, /Playing\*\* Al-Kahf/);
			assert.deepEqual(edits.length, 1);
		} finally {
			mock.timers.reset();
		}
	});

	it("the picker timeout posts a notice instead when there is no default", async () => {
		mock.timers.enable({ apis: ["setTimeout"] });

		try {
			const harness = makePlayer();
			const config = new GuildConfig(storeWithReciter(10, 99));
			const playback = makePlayback(harness, config);
			const { input, followUps } = makeRequestInput(harness);

			await playback.request(input);

			mock.timers.tick(101);
			await flush();

			assert.match(followUps[0]!.content!, /Nothing picked/);
			assert.deepEqual(harness.played, []);
		} finally {
			mock.timers.reset();
		}
	});
});

describe("PlaybackRequest — Radio confirm branch", () => {
	function setupRadioPending() {
		const harness = makePlayer();
		harness.setRadio(true);
		const playback = makePlayback(harness);
		playback.attach(harness.player, "en");
		const { input, edits } = makeRequestInput(harness, {
			reciter: "أكرم العلاقمي",
		});

		return { harness, playback, input, edits };
	}

	it("parks the Recitation behind a radio-confirm prompt while Radio plays", async () => {
		const { harness, playback, input, edits } = setupRadioPending();

		await playback.request(input);

		assert.deepEqual(harness.calls, ["join:voice-1", "setNoticeChannel"]);
		assert.match(edits[0]!.content!, /Quran Radio/);
		assert.deepEqual(buttonIds(edits[0]), [
			"confirm:radio-to-queue",
			"cancel:radio-to-queue",
		]);
	});

	it("confirmRadioToQueue stops the Radio and plays the pending Recitation", async () => {
		const { harness, playback, input, edits } = setupRadioPending();
		await playback.request(input);

		const updates: EditRecord[] = [];

		await playback.confirmRadioToQueue({
			guildId: "g-1",
			locale: "en",
			translator: localizable("en"),
			update: async (reply) => {
				updates.push(reply);
			},
			replyEphemeral: async () => undefined,
		});

		assert.deepEqual(harness.calls, [
			"join:voice-1",
			"setNoticeChannel",
			"stopRadio",
			"play",
		]);
		assert.match(updates[0]!.content!, /Playing\*\* Al-Kahf/);
		assert.equal(edits.length, 1);
	});

	it("a restarted Radio drops the outstanding confirmation", async () => {
		const { harness, playback, input } = setupRadioPending();
		await playback.request(input);
		assert.deepEqual(harness.played, []);

		// A different radio starts while the prompt is still outstanding.
		harness.setRadio(true);
		for (const fire of harness.radioChanges) fire();

		const ephemerals: string[] = [];

		await playback.confirmRadioToQueue({
			guildId: "g-1",
			locale: "en",
			translator: localizable("en"),
			update: async () => undefined,
			replyEphemeral: async (content) => {
				ephemerals.push(content);
			},
		});

		assert.equal(ephemerals.length, 1);
		assert.match(ephemerals[0]!, /Couldn't resolve that recitation/);
		assert.deepEqual(harness.calls, ["join:voice-1", "setNoticeChannel"]);
	});

	it("cancelRadioToQueue keeps the Radio playing and drops the pending Recitation", async () => {
		const { harness, playback, input } = setupRadioPending();
		await playback.request(input);

		const updates: EditRecord[] = [];

		await playback.cancelRadioToQueue({
			guildId: "g-1",
			locale: "en",
			translator: localizable("en"),
			update: async (reply) => {
				updates.push(reply);
			},
			replyEphemeral: async () => undefined,
		});

		assert.match(updates[0]!.content!, /Quran Radio/);
		assert.deepEqual(harness.calls, ["join:voice-1", "setNoticeChannel"]);

		const ephemerals: string[] = [];

		// Nothing is pending anymore — a late confirm is refused ephemerally.
		await playback.confirmRadioToQueue({
			guildId: "g-1",
			locale: "en",
			translator: localizable("en"),
			update: async () => undefined,
			replyEphemeral: async (content) => {
				ephemerals.push(content);
			},
		});

		assert.equal(ephemerals.length, 1);
		assert.deepEqual(harness.calls, ["join:voice-1", "setNoticeChannel"]);
	});

	it("replies ephemerally notConnected when the session is gone", async () => {
		const playback = makePlayback(undefined);
		const ephemerals: string[] = [];

		await playback.confirmRadioToQueue({
			guildId: "g-1",
			locale: "en",
			translator: localizable("en"),
			update: async () => undefined,
			replyEphemeral: async (content) => {
				ephemerals.push(content);
			},
		});

		assert.match(ephemerals[0]!, /not connected to a voice channel/);
	});
});

describe("PlaybackRequest — side-effects owned by attach()", () => {
	it("routes playback-failure notices to the session's notice channel", async () => {
		const sends: unknown[] = [];
		const harness = makePlayer({ isPlaying: true });
		const playback = makePlayback(harness);
		const channel = {
			id: "text-1",
			send: async (payload: unknown) => {
				sends.push(payload);
				return { id: "sent-1" };
			},
		};

		playback.attach(harness.player, "en");
		// The fake player records the notice listener; hand it the channel the
		// way setNoticeChannel would on the real Player.
		Object.defineProperty(harness.player, "noticeChannel", {
			get: () => channel,
			configurable: true,
		});

		harness.notices[0]?.("A notice for you");

		assert.deepEqual(sends, ["A notice for you"]);
	});

	it("auto-posts the PlayerPanel on the first playback start after attach", async () => {
		const guildId = "playback-panel-guild";
		const harness = makePlayer({ guildId, isPlaying: true });
		const playback = makePlayback(harness);
		const payload = {
			surah: alKahf,
			reciterId: 10,
			reciterName: "أكرم العلاقمي",
			rewayahId: 10,
			rewayahName: "حفص عن عاصم - مرتل",
			url: "https://fixture/mc10/018.mp3",
		} satisfies Recitation;
		const channel = {
			id: "text-1",
			messages: { fetch: async () => new Set() },
			send: async () => ({ id: "panel-1" }),
		};
		const panelPlayer = {
			...harness.player,
			guildId,
			queueView: { current: payload, upcoming: [], repeatMode: "off" },
			isPaused: false,
		};

		playback.attach(panelPlayer as unknown as Player, "en");
		Object.defineProperty(panelPlayer, "noticeChannel", {
			get: () => channel,
			configurable: true,
		});

		for (const fire of harness.changes) fire();
		await flush();
		await flush();

		assert.equal(hasPanel(guildId), true);
	});
});

describe("picker customId helpers", () => {
	const choices = [
		{
			surahNumber: 18,
			reciterId: 1,
			reciterName: "إبراهيم الأخضر",
			rewayahId: 1,
			rewayahName: "حفص عن عاصم - مرتل",
		},
	];

	it("round-trips a picker button id", () => {
		const customId = pickerCustomId(choices[0]!);

		assert.equal(customId, "rewayah-play:18:1:1");
		assert.deepEqual(parsePickerCustomId(customId), {
			surahNumber: 18,
			reciterId: 1,
			rewayahId: 1,
		});
		assert.equal(parsePickerCustomId("other:1"), undefined);
		assert.equal(parsePickerCustomId("rewayah-play:18:1:abc"), undefined);
	});
});

describe("context wiring", () => {
	it("the /play command crosses exactly one seam call through context.playback", async () => {
		const harness = makePlayer();
		const config = guildConfig();
		const playback = makePlayback(harness, config);

		const context: CommandContext = {
			players: {
				getOrCreate: () => harness.player,
				get: () => undefined,
				remove: () => undefined,
			},
			catalog,
			guildConfigs: config,
			playback,
			locale: "en",
			translator: localizable("en"),
		};

		const edits: Array<{ content: string }> = [];
		const interaction = {
			inCachedGuild: () => true,
			member: { voice: { channel: { id: "voice-1" } } },
			user: { id: "user-1" },
			options: {
				getString: (key: string) => (key === "surah" ? "18" : "أكرم العلاقمي"),
			},
			guildId: "g-1",
			channel: { id: "text-1" },
			deferReply: async () => undefined,
			editReply: async (payload: { content: string }) => {
				edits.push(payload);
				return { id: "msg-1" };
			},
			reply: async () => undefined,
			replied: false,
			deferred: false,
			followUp: async () => undefined,
		};

		await playCommand.execute(context, interaction as never);

		assert.equal(edits.length, 1);
		assert.match(edits[0]!.content!, /Playing\*\* Al-Kahf/);
		assert.deepEqual(harness.calls, [
			"join:voice-1",
			"setNoticeChannel",
			"play",
		]);
	});
});

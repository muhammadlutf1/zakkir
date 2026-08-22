import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { AudioPlayerStatus } from "@discordjs/voice";
import type { Message, VoiceChannel } from "discord.js";
import { MessageFlags } from "discord.js";
import type { Locale } from "../../src/i18n/locale";
import {
	buildPanelPayload,
	createPanel,
	getPanel,
	hasPanel,
	PANEL_PAUSE_CUSTOM_ID,
	PANEL_REPEAT_CUSTOM_ID,
	PANEL_SELECT_CUSTOM_ID,
	PANEL_SKIP_CUSTOM_ID,
	PANEL_STOP_CUSTOM_ID,
	updatePanel,
} from "../../src/play/playerPanel";
import { Player } from "../../src/voice/Player";
import { RepeatMode } from "../../src/voice/Queue";
import type { Recitation } from "../../src/voice/Recitation";
import type {
	VoicePort,
	VoicePortEventName,
	VoicePortEventPayload,
	VoicePortEvents,
} from "../../src/voice/VoicePort";

class FakeVoicePort implements VoicePort {
	readonly calls: string[] = [];
	private _joinedChannelId: string | null = null;

	get joinedChannelId() {
		return this._joinedChannelId;
	}

	private listeners: {
		[K in VoicePortEventName]: Set<VoicePortEvents[K]>;
	} = {
		stateChange: new Set(),
		playerStateChange: new Set(),
		streamError: new Set(),
		error: new Set(),
	};

	async join(channel: VoiceChannel) {
		this._joinedChannelId = channel.id;
		this.calls.push(`join:${channel.id}`);
	}

	leave() {
		this.calls.push("leave");
		this._joinedChannelId = null;
	}

	play(url: string) {
		this.calls.push(`play:${url}`);
	}

	stop() {
		this.calls.push("stop");
	}

	pause() {
		this.calls.push("pause");
	}

	unpause() {
		this.calls.push("unpause");
	}

	destroy() {
		this.calls.push("destroy");
	}

	on<K extends VoicePortEventName>(event: K, listener: VoicePortEvents[K]) {
		this.listeners[event].add(listener);
	}

	off<K extends VoicePortEventName>(event: K, listener: VoicePortEvents[K]) {
		this.listeners[event].delete(listener);
	}

	emit<K extends VoicePortEventName>(
		event: K,
		payload: VoicePortEventPayload<K>,
	) {
		for (const listener of this.listeners[event]) {
			(listener as (payload: VoicePortEventPayload<K>) => void)(payload);
		}
	}
}

interface ComponentJson {
	type: number;
	content?: string;
	accent_color?: number;
	components?: ComponentJson[];
	custom_id?: string;
	label?: string;
	style?: number;
	disabled?: boolean;
	placeholder?: string;
	default?: boolean;
	emoji?: { name?: string; id?: string };
	options?: Array<{ label: string; value: string; default?: boolean }>;
}

interface SentPayload {
	components: unknown[];
	flags: number;
}

function makeMessage(id: string) {
	const raw = { id } as Message;
	const edits: SentPayload[] = [];
	let deletions = 0;

	const message = Object.assign(raw, {
		async edit(payload: SentPayload) {
			edits.push(payload);
			return message;
		},
		async delete() {
			deletions += 1;
			return message;
		},
	});

	return {
		message,
		edits,
		get deletions() {
			return deletions;
		},
	};
}

function makeChannel(recentIds: readonly string[]) {
	const handles: ReturnType<typeof makeMessage>[] = [];
	let counter = 0;

	const channel = {
		id: "text-1",
		async send(_payload: SentPayload) {
			counter += 1;
			const handle = makeMessage(`sent-${counter}`);
			handles.push(handle);
			return handle.message;
		},
		messages: {
			async fetch(_options: { limit: number }) {
				return { has: (id: string) => recentIds.includes(id) };
			},
		},
	};

	return { channel, handles };
}

function flatten(components: ComponentJson[]): ComponentJson[] {
	return components.flatMap((c) => [c, ...flatten(c.components ?? [])]);
}

function containerOf(player: Player, locale: Locale = "en", disabled = false) {
	const payload = buildPanelPayload(player, locale, disabled);
	return { payload, container: payloadContainer(payload) };
}

function payloadContainer(payload: SentPayload): ComponentJson {
	return (
		payload.components as Array<{ toJSON(): ComponentJson }>
	)[0]!.toJSON();
}

function textContents(container: ComponentJson): string[] {
	return flatten(container.components ?? [])
		.filter((c) => c.type === 10)
		.map((c) => c.content!);
}

function buttons(container: ComponentJson): ComponentJson[] {
	return flatten(container.components ?? []).filter((c) => c.type === 2);
}

function buttonByCustomId(container: ComponentJson, customId: string) {
	return buttons(container).find((b) => b.custom_id === customId)!;
}

function selectOf(container: ComponentJson): ComponentJson {
	return flatten(container.components ?? []).find((c) => c.type === 3)!;
}

async function flush() {
	for (let i = 0; i < 10; i++) {
		await new Promise<void>((resolve) => setImmediate(resolve));
	}
}

function recitation(overrides: Partial<Recitation> = {}): Recitation {
	return {
		surah: { number: 18, name: "الكهف", names: { en: "Al-Kahf" } },
		reciterId: 1,
		reciterName: "إبراهيم الأخضر",
		rewayahId: 1,
		rewayahName: "حفص عن عاصم",
		url: "https://example.com/018.mp3",
		...overrides,
	};
}

function makePlayer(guildId: string) {
	return new Player(guildId, new FakeVoicePort(), {
		probeStream: async () => true,
	});
}

describe("buildPanelPayload", () => {
	it("sends with the IsComponentsV2 flag and the accent color", async () => {
		const player = makePlayer("panel-flags");
		await player.play(recitation());

		const { payload, container } = containerOf(player);

		assert.equal(payload.flags, MessageFlags.IsComponentsV2);
		assert.equal(payload.flags, 32768);
		assert.equal(container.accent_color, 0x2b2d31);
	});

	it("renders the title with the book emote and the localized surah name", async () => {
		const player = makePlayer("panel-title");
		await player.play(recitation());

		const en = textContents(containerOf(player, "en").container);
		assert.equal(
			en[0],
			"<:book:1384273893149249546> Surah Al-Kahf by إبراهيم الأخضر",
		);

		const ar = textContents(containerOf(player, "ar").container);
		assert.equal(
			ar[0],
			"<:book:1384273893149249546> سورة الكهف بصوت القارئ إبراهيم الأخضر",
		);
	});

	it("shows the rewayah alone as the subtitle", async () => {
		const player = makePlayer("panel-rewayah");
		await player.play(recitation({ rewayahName: "حفص عن عاصم" }));

		const texts = textContents(containerOf(player).container);

		assert.deepEqual(texts.slice(0, 2), [
			"<:book:1384273893149249546> Surah Al-Kahf by إبراهيم الأخضر",
			"حفص عن عاصم",
		]);
	});

	it("drops the subtitle when the rewayah duplicates the reciter name", async () => {
		const player = makePlayer("panel-dedupe");
		await player.play(
			recitation({ reciterName: "Mishary", rewayahName: "mishary" }),
		);

		const texts = textContents(containerOf(player).container);

		assert.equal(texts.length, 3);
		assert.ok(!texts.includes("mishary"));
	});

	it("renders the repeat mode in upper case", async () => {
		const player = makePlayer("panel-repeat");
		await player.play(recitation());
		player.setRepeatMode(RepeatMode.OFF);
		assert.ok(
			textContents(containerOf(player).container).includes("Repeat Mode: Off"),
		);

		player.setRepeatMode(RepeatMode.TRACK);
		assert.ok(
			textContents(containerOf(player).container).includes(
				"Repeat Mode: Repeat Track",
			),
		);

		player.setRepeatMode(RepeatMode.ALL);
		assert.ok(
			textContents(containerOf(player).container).includes(
				"Repeat Mode: Repeat All",
			),
		);
	});

	it("always includes the note line verbatim, below the controls", () => {
		const player = makePlayer("panel-note");

		const container = containerOf(player).container;
		const children = container.components ?? [];
		const noteIndex = children.findIndex(
			(c) =>
				c.type === 10 &&
				c.content?.includes("Note: To skip without clearing previous tracks"),
		);
		const lastRow = children.map((c) => c.type).lastIndexOf(1);

		assert.ok(noteIndex !== -1);
		assert.ok(lastRow !== -1);
		assert.ok(noteIndex > lastRow);
	});
});

describe("panel controls", () => {
	it("shows a Pause button while playing", async () => {
		const player = makePlayer("panel-pause");
		await player.play(recitation());

		const pauseButton = buttonByCustomId(
			containerOf(player).container,
			PANEL_PAUSE_CUSTOM_ID,
		);

		assert.equal(pauseButton.label, "Pause");
		assert.equal(pauseButton.emoji?.id, "1384273881040289924");
		assert.equal(pauseButton.style, 2);
	});

	it("swaps to Resume with the play emote when paused", async () => {
		const player = makePlayer("panel-resume");
		await player.play(recitation());
		player.pause();

		const pauseButton = buttonByCustomId(
			containerOf(player).container,
			PANEL_PAUSE_CUSTOM_ID,
		);

		assert.equal(pauseButton.label, "Resume");
		assert.equal(pauseButton.emoji?.id, "1384273884622229514");
		assert.equal(pauseButton.style, 2);
	});

	it("wires Stop, Skip, and Loop with their emotes, all Secondary", async () => {
		const player = makePlayer("panel-controls");
		await player.play(recitation());

		const container = containerOf(player).container;

		const stopButton = buttonByCustomId(container, PANEL_STOP_CUSTOM_ID);
		assert.equal(stopButton.label, "Stop");
		assert.equal(stopButton.emoji?.id, "1384273886652137665");

		const skipButton = buttonByCustomId(container, PANEL_SKIP_CUSTOM_ID);
		assert.equal(skipButton.label, "Skip");
		assert.equal(skipButton.emoji?.id, "1384273873427759278");

		const repeatButton = buttonByCustomId(container, PANEL_REPEAT_CUSTOM_ID);
		assert.equal(repeatButton.label, "Loop");
		assert.equal(repeatButton.emoji?.id, "1384278335114449060");

		for (const button of buttons(container)) {
			assert.equal(button.style, 2);
		}
	});
});

describe("the track select", () => {
	it("lists every entry as `{surahName} - {reciterName}` with the current track preselected", async () => {
		const player = makePlayer("panel-select");
		await player.play(recitation());
		await player.play(
			recitation({
				surah: { number: 19, name: "مريم", names: { en: "Maryam" } },
				url: "https://example.com/019.mp3",
			}),
		);

		const select = selectOf(containerOf(player).container);

		assert.equal(select.custom_id, PANEL_SELECT_CUSTOM_ID);
		assert.deepEqual(
			select.options?.map((option) => option.label),
			["Al-Kahf - إبراهيم الأخضر", "Maryam - إبراهيم الأخضر"],
		);
		assert.deepEqual(
			select.options?.map((option) => option.default === true),
			[true, false],
		);
	});

	it("caps at 25 options", async () => {
		const player = makePlayer("panel-select-cap");
		for (let number = 1; number <= 30; number++) {
			await player.play(
				recitation({
					surah: { number, name: `سورة-${number}` },
					url: `https://example.com/${number}.mp3`,
				}),
			);
		}

		const select = selectOf(containerOf(player).container);

		assert.equal(select.options?.length, 25);
	});

	it("is disabled with a placeholder on an empty queue", () => {
		const player = makePlayer("panel-select-empty");

		const container = containerOf(player).container;
		const select = selectOf(container);

		assert.equal(select.disabled, true);
		assert.equal(select.placeholder, "No tracks queued");
		assert.equal(select.options?.length, 1);
		assert.equal(select.options?.[0]?.label, "No tracks queued");

		for (const button of buttons(container)) {
			assert.equal(button.disabled, true);
		}
	});
});

describe("empty-queue header", () => {
	it("still renders the Repeat Mode line with nothing queued", () => {
		const player = makePlayer("panel-repeat-empty");

		const texts = textContents(containerOf(player).container);

		assert.ok(texts.includes("Repeat Mode: Off"));
		assert.ok(!texts.some((text) => text.includes("Surah ")));
	});
});

describe("createPanel", () => {
	it("posts the payload and registers the guild's panel", async () => {
		const guildId = "panel-create";
		const player = makePlayer(guildId);
		await player.play(recitation());
		const { channel, handles } = makeChannel([]);

		const message = await createPanel(
			player,
			channel as unknown as Parameters<typeof createPanel>[1],
			"en",
		);

		assert.equal(handles.length, 1);
		assert.equal(message.id, handles[0]!.message.id);
		assert.equal(handles[0]!.edits.length, 0);
		assert.equal(hasPanel(guildId), true);
		assert.deepEqual(getPanel(guildId), {
			messageId: handles[0]!.message.id,
			channelId: "text-1",
		});
	});

	it("disables every control once the queue drains naturally", async () => {
		const guildId = "panel-drain";
		const port = new FakeVoicePort();
		const player = new Player(guildId, port, { probeStream: async () => true });
		await player.play(recitation());
		await player.play(
			recitation({
				surah: { number: 19, name: "مريم", names: { en: "Maryam" } },
				url: "https://example.com/019.mp3",
			}),
		);
		const { channel, handles } = makeChannel([]);
		await createPanel(
			player,
			channel as unknown as Parameters<typeof createPanel>[1],
			"en",
		);
		channel.messages.fetch = async () => ({
			has: (id: string) => id === getPanel(guildId)!.messageId,
		});

		port.emit("playerStateChange", AudioPlayerStatus.Idle);
		await flush();
		assert.equal(handles[0]!.edits.length, 1);
		assert.ok(
			textContents(payloadContainer(handles[0]!.edits[0]!)).some((text) =>
				text.includes("Surah Maryam"),
			),
		);

		port.emit("playerStateChange", AudioPlayerStatus.Idle);
		await flush();

		assert.ok(handles[0]!.edits.length >= 2);
		assert.equal(hasPanel(guildId), true);

		const edit = handles[0]!.edits.at(-1)!;
		assert.equal(edit.flags, MessageFlags.IsComponentsV2);
		const container = payloadContainer(edit);
		for (const interactive of [...buttons(container), selectOf(container)]) {
			assert.equal(interactive.disabled, true);
		}
		assert.ok(
			textContents(container).includes(
				"Queue finished — use `/play` to add more.",
			),
		);
	});
});

describe("updatePanel", () => {
	it("edits the panel in place when it is still in the recent window", async () => {
		const guildId = "panel-visible";
		const player = makePlayer(guildId);
		await player.play(recitation());
		const { channel, handles } = makeChannel([]);
		await createPanel(
			player,
			channel as unknown as Parameters<typeof createPanel>[1],
			"en",
		);

		const panelId = getPanel(guildId)!.messageId;
		channel.messages.fetch = async () => ({
			has: (id: string) => id === panelId,
		});

		updatePanel(guildId);
		await flush();

		assert.equal(handles[0]!.edits.length, 1);
		assert.equal(handles[0]!.edits[0]!.flags, MessageFlags.IsComponentsV2);
		assert.equal(handles[0]!.deletions, 0);
		assert.equal(handles.length, 1);
	});

	it("deletes and reposts a buried panel at the bottom of the channel", async () => {
		const guildId = "panel-buried";
		const player = makePlayer(guildId);
		await player.play(recitation());
		const buriedWindow = Array.from({ length: 15 }, (_, i) => `other-${i}`);
		const { channel, handles } = makeChannel(buriedWindow);
		await createPanel(
			player,
			channel as unknown as Parameters<typeof createPanel>[1],
			"en",
		);
		const oldId = getPanel(guildId)!.messageId;

		updatePanel(guildId);
		await flush();

		assert.equal(handles[0]!.deletions, 1);
		assert.equal(handles[0]!.edits.length, 0);
		assert.equal(handles.length, 2);
		assert.notEqual(getPanel(guildId)!.messageId, oldId);
		assert.equal(getPanel(guildId)!.messageId, handles[1]!.message.id);
		assert.equal(handles[1]!.edits.length, 0);
	});

	it("re-renders when the player's change listeners fire", async () => {
		const guildId = "panel-onchange";
		const player = makePlayer(guildId);
		await player.play(recitation());
		const { channel, handles } = makeChannel([]);
		await createPanel(
			player,
			channel as unknown as Parameters<typeof createPanel>[1],
			"en",
		);
		channel.messages.fetch = async () => ({
			has: (id: string) => id === getPanel(guildId)!.messageId,
		});

		player.setRepeatMode(RepeatMode.ALL);
		await flush();

		assert.ok(handles[0]!.edits.length >= 1);
		assert.ok(
			textContents(payloadContainer(handles[0]!.edits[0]!)).includes(
				"Repeat Mode: Repeat All",
			),
		);
	});
});

describe("session end", () => {
	it("disables every control, keeps the message, and forgets the panel", async () => {
		const guildId = "panel-end";
		const player = makePlayer(guildId);
		await player.play(recitation());
		const { channel, handles } = makeChannel([]);
		await createPanel(
			player,
			channel as unknown as Parameters<typeof createPanel>[1],
			"en",
		);

		player.endSession();
		await flush();

		assert.equal(handles[0]!.edits.length, 1);
		assert.equal(handles[0]!.deletions, 0);
		assert.equal(handles.length, 1);
		assert.equal(hasPanel(guildId), false);

		const edit = handles[0]!.edits[0]!;
		assert.equal(edit.flags, MessageFlags.IsComponentsV2);
		const container = payloadContainer(edit);
		for (const interactive of [...buttons(container), selectOf(container)]) {
			assert.equal(interactive.disabled, true);
		}
	});
});

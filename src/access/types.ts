import type { PartialGroupDMChannel, TextBasedChannel } from "discord.js";

export type SendableTextChannel = Exclude<
	TextBasedChannel,
	PartialGroupDMChannel
>;

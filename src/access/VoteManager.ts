import {
	ActionRowBuilder,
	ButtonBuilder,
	ButtonStyle,
	type Message,
	type TextBasedChannel,
} from "discord.js";
import { createLogger } from "../core/logger";
import type { Locale, Localizable } from "../i18n/locale";
import type { PanelSnapshot } from "../play/playerPanel";

const logger = createLogger("VoteManager");

export const VOTE_YES_CUSTOM_ID = "vote:yes";
export const VOTE_NO_CUSTOM_ID = "vote:no";

const VOTE_TIMEOUT_MS = 20_000;

type VoteOutcome = "passed" | "rejected" | "cancelled" | "replaced";

interface ActiveVote {
	guildId: string;
	initiatorId: string;
	voters: Set<string>;
	votes: Map<string, "yes" | "no">;
	channel: TextBasedChannel;
	message?: Message;
	timer?: NodeJS.Timeout;
	locale: Locale;
	translator: Localizable;
	label: string;
	onPass: () => Promise<void>;
	resolved: boolean;
}

export interface VoteProposeInput {
	guildId: string;
	initiatorId: string;
	/** Human listener ids in the Player's voice channel at proposal time. */
	voterIds: string[];
	channel: TextBasedChannel;
	panel?: PanelSnapshot;
	locale: Locale;
	translator: Localizable;
	label: string;
	onPass: () => Promise<void>;
}

export class VoteManager {
	private readonly votes = new Map<string, ActiveVote>();

	get(guildId: string): ActiveVote | undefined {
		return this.votes.get(guildId);
	}

	/**
	 * Proposes a new Vote for the guild. Replaces any pending Vote:
	 * the previous Vote's message is edited to a "replaced" outcome with
	 * disabled buttons.
	 */
	async propose(input: VoteProposeInput): Promise<ActiveVote | undefined> {
		const existing = this.votes.get(input.guildId);
		if (existing) {
			await this.resolve(existing, "replaced");
		}

		if (input.voterIds.length === 0) {
			return undefined;
		}

		const vote: ActiveVote = {
			guildId: input.guildId,
			initiatorId: input.initiatorId,
			voters: new Set(input.voterIds),
			votes: new Map([[input.initiatorId, "yes"]]),
			channel: input.channel,
			locale: input.locale,
			translator: input.translator,
			label: input.label,
			onPass: input.onPass,
			resolved: false,
		};

		this.votes.set(input.guildId, vote);

		const content = this.buildContent(vote);
		const components = this.buildComponents(vote, false);

		try {
			const sendPayload: Record<string, unknown> = {
				content,
				components,
			};

			if (input.panel) {
				(sendPayload as { reply: { messageReference: string } }).reply = {
					messageReference: input.panel.messageId,
				};
			}

			const message = await (
				input.channel as unknown as {
					send: (payload: unknown) => Promise<Message>;
				}
			).send(sendPayload);

			vote.message = message;

			// Early resolve if the initiator alone guarantees pass (e.g. total 1 with yes 1)
			await this.checkEarly(vote);
			if (vote.resolved) return vote;

			vote.timer = setTimeout(() => {
				void this.onTimeout(vote);
			}, VOTE_TIMEOUT_MS);
			vote.timer.unref?.();
		} catch (error) {
			logger.error(error, "Failed to post vote in guild %s", input.guildId);
			this.votes.delete(input.guildId);
			return undefined;
		}

		return vote;
	}

	async handleVote(
		guildId: string,
		userId: string,
		choice: "yes" | "no",
	): Promise<void> {
		const vote = this.votes.get(guildId);
		if (!vote || vote.resolved) return;
		if (!vote.voters.has(userId)) return;

		vote.votes.set(userId, choice);
		await this.refresh(vote);
		await this.checkEarly(vote);
	}

	/**
	 * Live Voters update: caller provides the current human listener ids.
	 * If the Initiator left, the Vote is cancelled.
	 */
	async handleVoiceUpdate(
		guildId: string,
		currentVoterIds: string[],
	): Promise<void> {
		const vote = this.votes.get(guildId);
		if (!vote || vote.resolved) return;

		const currentSet = new Set(currentVoterIds);

		// Initiator left -> cancel
		if (!currentSet.has(vote.initiatorId)) {
			await this.resolve(vote, "cancelled");
			return;
		}

		// Sync voters: remove departed votes, keep votes of remaining
		for (const id of [...vote.voters]) {
			if (!currentSet.has(id)) {
				vote.voters.delete(id);
				vote.votes.delete(id);
			}
		}
		for (const id of currentSet) {
			vote.voters.add(id);
		}

		await this.refresh(vote);
		await this.checkEarly(vote);
	}

	async handleInitiatorLeave(guildId: string, userId: string): Promise<void> {
		const vote = this.votes.get(guildId);
		if (!vote || vote.resolved) return;
		if (vote.initiatorId !== userId) return;
		await this.resolve(vote, "cancelled");
	}

	private async onTimeout(vote: ActiveVote): Promise<void> {
		if (vote.resolved) return;
		const { yes, no } = this.counts(vote);
		if (yes > no) {
			await this.executePass(vote);
		} else {
			await this.resolve(vote, "rejected");
		}
	}

	private async checkEarly(vote: ActiveVote): Promise<void> {
		if (vote.resolved) return;
		const { yes, no, total } = this.counts(vote);
		const undecided = total - yes - no;
		if (yes > no + undecided) {
			await this.executePass(vote);
			return;
		}
		if (yes + undecided <= no) {
			await this.resolve(vote, "rejected");
		}
	}

	private async executePass(vote: ActiveVote): Promise<void> {
		try {
			await vote.onPass();
		} catch (error) {
			logger.error(error, "Vote pass action failed in guild %s", vote.guildId);
		}
		await this.resolve(vote, "passed");
	}

	private counts(vote: ActiveVote) {
		let yes = 0;
		let no = 0;
		for (const v of vote.votes.values()) {
			if (v === "yes") yes += 1;
			else no += 1;
		}
		return { yes, no, total: vote.voters.size };
	}

	private buildContent(vote: ActiveVote, outcome?: VoteOutcome): string {
		const mentions = [...vote.voters].map((id) => `<@${id}>`).join(" ");
		const base = vote.translator.t("vote.prompt", { label: vote.label });
		const mentionPart = mentions ? `${mentions} ` : "";
		let suffix = "";
		if (outcome === "passed")
			suffix = `\n${vote.translator.t("vote.passed", { label: vote.label })}`;
		else if (outcome === "rejected")
			suffix = `\n${vote.translator.t("vote.rejected")}`;
		else if (outcome === "cancelled")
			suffix = `\n${vote.translator.t("vote.cancelled")}`;
		else if (outcome === "replaced")
			suffix = `\n${vote.translator.t("vote.replaced")}`;
		return `${mentionPart}${base}${suffix}`;
	}

	private buildComponents(vote: ActiveVote, disabled: boolean) {
		const { yes, no, total } = this.counts(vote);
		const yesLabel = `Yes (${yes}/${total})`;
		const noLabel = `No (${no}/${total})`;
		const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
			new ButtonBuilder()
				.setCustomId(VOTE_YES_CUSTOM_ID)
				.setLabel(yesLabel)
				.setStyle(ButtonStyle.Success)
				.setDisabled(disabled),
			new ButtonBuilder()
				.setCustomId(VOTE_NO_CUSTOM_ID)
				.setLabel(noLabel)
				.setStyle(ButtonStyle.Danger)
				.setDisabled(disabled),
		);
		return [row];
	}

	private async refresh(vote: ActiveVote): Promise<void> {
		if (!vote.message) return;
		const content = this.buildContent(vote);
		const components = this.buildComponents(vote, false);
		try {
			await vote.message.edit({ content, components });
		} catch (error) {
			logger.warn(
				error,
				"Failed to refresh vote message in guild %s",
				vote.guildId,
			);
		}
	}

	private async resolve(vote: ActiveVote, outcome: VoteOutcome): Promise<void> {
		if (vote.resolved) return;
		vote.resolved = true;
		if (vote.timer) {
			clearTimeout(vote.timer);
			vote.timer = undefined;
		}
		this.votes.delete(vote.guildId);
		const content = this.buildContent(vote, outcome);
		const components = this.buildComponents(vote, true);
		if (vote.message) {
			try {
				await vote.message.edit({ content, components });
			} catch (error) {
				logger.warn(
					error,
					"Failed to resolve vote message in guild %s",
					vote.guildId,
				);
			}
		}
	}

	/** For tests: clear all votes and timers. */
	clearAll() {
		for (const vote of this.votes.values()) {
			if (vote.timer) clearTimeout(vote.timer);
		}
		this.votes.clear();
	}
}

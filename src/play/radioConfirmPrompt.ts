import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from "discord.js";
import type { Locale, Localizable } from "../i18n/locale";
import { recitationLabel } from "../i18n/recitationLabel";
import type { Player } from "../voice/Player";
import type { Recitation } from "../voice/Recitation";

export function radioConfirmReply(
	player: Player,
	recitation: Recitation,
	locale: Locale,
	translator: Localizable,
) {
	player.setPendingRadioConfirm(recitation);
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

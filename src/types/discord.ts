import type {
	DiscordAPIError,
	GuildMember,
	Message,
	MessageComponentInteraction,
	PermissionsBitField,
} from "discord.js";

export type DeletableMessage = Pick<Message, "delete">;
export type EditableMessage = Pick<Message, "edit">;
export type ReplyableInteraction = Pick<
	MessageComponentInteraction<"cached">,
	"reply"
>;
export type FollowUpableInteraction = Pick<
	MessageComponentInteraction<"cached">,
	"followUp"
>;
export type HasPermissions = Pick<PermissionsBitField, "has">;
export type GuildPermissionsLike = Pick<GuildMember["permissions"], "has">;
export type CodedDiscordError = Pick<DiscordAPIError, "code">;

import { type GuildMember, PermissionFlagsBits } from "discord.js";
import type { GuildPermissionsLike } from "../types";
import type { Player } from "../voice/Player";
import type { Recitation } from "../voice/Recitation";

export interface GateCheck {
	member: Pick<GuildMember, "id"> & {
		permissions?: GuildPermissionsLike;
	};
	player: Pick<Player, "humanMemberCount">;
	recitation?: Recitation;
}

/**
 * Gate — decides whether a member is Qualified to act directly
 * without a Vote. Qualified when any of:
 * - holds MoveMembers permission
 * - is alone with the Player in its voice channel (human count 1)
 * - requested the affected Recitation
 */
export function isQualified(check: GateCheck): boolean {
	if (check.member.permissions?.has(PermissionFlagsBits.MoveMembers))
		return true;
	if (check.player.humanMemberCount === 1) return true;
	if (check.recitation?.requestedBy === check.member.id) return true;
	return false;
}

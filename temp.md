# Ticket: Codebase-wide Pick<> cleanup

**Delete this file after reading.** (self-destruct ticket)

## Context
We just refactored `src/components/player-panel/autoDelete.ts` on branch `feat/panel-visible-autodelete` (commit `290f0fb`):
- Before: hand-rolled `{ delete(): Promise<unknown> }`, `{ reply(options: Record<string,unknown>): Promise<unknown> }`, plus `as unknown as` casts for `unref`.
- After: `Pick<Message, "delete">`, `Pick<MessageComponentInteraction<"cached">, "reply" | "followUp">`, `withResponse: true` + `response.resource!.message`, no deprecated `fetchReply`.

The inline-shape style still exists elsewhere.

## Task
Do the same `Pick<>` cleanup for the **whole codebase**:

1. Grep `src/` (and `__tests__/` if it leaks into src types) for hand-rolled object shapes that duplicate discord.js / other library types:
   - Examples: `{ delete(): ... }`, `{ reply(...) }`, `{ followUp(...) }`, `{ send(...) }`, `{ has(flag: bigint): boolean }` (permissions), `{ edit(...) }`, etc.
   - Any `as { delete?: unknown }`, `as unknown as`, or `Record<string, unknown>` used to approximate a library type.

2. Replace each with `Pick<SourceType, "key" | ...>` from the canonical import (`discord.js` `Message`, `MessageComponentInteraction`, `GuildMember`, `PermissionsBitField`, etc.). Prefer `import type`.

3. If a picked shape is reused in ≥3 places, centralize it in a new `src/types/index.ts` (or `src/types/discord.ts`) and re-export:
   - e.g. `export type DeletableMessage = Pick<Message, "delete">;`
   - `export type Replyable = Pick<MessageComponentInteraction<"cached">, "reply">;`
   - Keep per-module local aliases only if used once.

4. Constraints (from `AGENTS.md`):
   - Don't use `as unknown as` double-casts — use `Pick`, `is*` guards, `instanceof`, `in`, or single `as` with `// SAFETY:` comment.
   - Don't add explicit return types where TS can infer.
   - Keep `fetchReply` → `withResponse` migration if you hit it (already done for autoDelete).

## Acceptance
- `pnpm lint` / `pnpm exec tsc --noEmit` / `pnpm test` / `pnpm build` all pass.
- No hand-rolled `{ method(): ... }` shapes remain where a `Pick<>` from `discord.js` (or other source lib) applies.
- Common picks live in `src/types/index.ts` if warranted; otherwise local `Pick` is fine.
- No functional change.

## After reading
Delete this file: `rm temp.md` (or `git rm temp.md` if tracked).

Branch: `feat/panel-visible-autodelete` — continue on same branch or new branch as you prefer, but do not amend the existing `290f0fb` commit for this ticket.

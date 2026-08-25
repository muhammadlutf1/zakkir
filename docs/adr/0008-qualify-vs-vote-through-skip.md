# Qualify-vs-vote tracer bullet through /skip

An unqualified member who tries to skip a Recitation could be denied outright
("you don't have permission"). We put a **Vote** in front instead: the request
opens a per-guild ballot that passes, times out, or is cancelled, and only on
pass does the skip execute. The first cut is `/skip` — the tracer bullet for
the whole access model.

## Context

The Queue now carries a **Requester** on every Recitation (`Recitation.requestedBy`
at `src/voice/Recitation.ts:15`), set from both `/play` paths — direct play
(`src/play/playbackRequest.ts:request`) and picker auto-play/timeout
(`src/play/playbackRequest.ts:ActivePicker`) — including the button presser's
id for `rewayah-play` picks (`src/components/buttons/rewayahPlay.ts`). The
queue's read view already exposes the current Recitation, so requester rides
along wherever the queue is read with no extra stores.

Privileged actions (`/skip` today) need an access check. Three natural
alternatives were: always allow, check and deny, or check and escalate. Always
allow makes the queue griefable; deny is cheap but exclusionary in a shared
listening context where most members lack `MoveMembers`. The design goal is to
keep the social default permissive without hard-permissioning every action.

## Decision

- **Qualified = holds `MoveMembers`, or is alone with the Player in its voice
  channel, or requested the affected Recitation(s).** Implemented as a single
  `isQualified` predicate (`src/access/Gate.ts:14`) — the **Gate**. Qualified
  members skip directly with no vote message (`src/commands/skip.ts`,
  `src/components/player-panel/skip.ts` via `src/access/skipAccess.ts`).

- **Unqualified = a Vote.** One active Vote per guild (`src/access/VoteManager.ts`);
  a new proposal replaces the old one (old message edited to a "replaced"
  outcome with disabled buttons). The vote is posted as a reply to the guild's
  `PlayerPanel` message (`src/play/playerPanel.ts:getPanel`) — standalone where
  the panel does not exist — in the session's notice channel, mentioning every
  human listener in the Player's voice channel
  (`Player.humanMemberIds` at `src/voice/Player.ts:141`). Buttons show live
  counts `Yes (n/count)` / `No (n/count)` against the live Voters set;
  the Initiator's Yes counts from the start and votes are changeable until
  resolve. The vote passes when Yes exceeds No among current Voters, rejects
  on a 20 s timeout, and early-resolves as soon as the outcome can no longer
  change (`Yes > No + undecided` passes, `Yes + undecided <= No` rejects).
  The Initiator leaving the voice channel cancels. On resolve the message is
  edited to show the outcome (`vote.passed|rejected|cancelled|replaced`) with
  buttons disabled.

- **Live Voters.** The Voters set is the live human-member set in the Player's
  voice channel. `voiceStateUpdate` (`src/events/voiceStateUpdate.ts:44`)
  re-reads `player.humanMemberIds` on every human move/join/leave and calls
  `VoteManager.handleVoiceUpdate`, which updates counts, re-renders the vote
  message, and re-checks early resolution/cancellation.

## Considered Options

- **Deny unqualified outright** (`needVoice`-style ephemeral denial) — rejected:
  it preserves queue integrity but forces every non-moderator to find a
  moderator for even cooperative skips. In a music-like shared session the
  expected norm is communal consent, not owner-only control.

- **Always allow skip** — rejected: trivial to grief the queue; requester
  tracking alone does not prevent it.

- **Vote with deny-on-timeout vs. require-quorum** — chosen deny-on-timeout
  plus early-resolution keeps the UX prompt (20 s) short and predictable; quorum
  variants add tuning without clearly better outcomes for a small VC.

- **Gate inside `Player.skip()` vs. outside** — kept outside. `Player` stays a
  voice/queue primitive; access lives in `src/access/` and the command/panel
  seams call the gate before `player.skip()`. This keeps the Player testable
  without Discord member/permission fakes.

## Consequences

- Every Recitation now carries `requestedBy`; call sites that build a
  Recitation must supply it (enforced by the type). No user-visible change by
  itself.
- `/skip` is the single privileged action behind the Gate today; panel Skip
  goes through the same path. Future actions (remove/clear/jump) reuse the same
  Gate/Vote with different `onPass` side-effects.
- The VoteManager owns timers and message edits; `voiceStateUpdate` is the
  single entry point for live voter tracking, so no polling.
- i18n keys `vote.*` cover prompt and outcomes in both `en` and `ar`
  (`src/i18n/messages/*`).


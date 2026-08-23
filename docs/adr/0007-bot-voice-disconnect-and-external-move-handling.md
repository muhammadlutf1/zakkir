# Bot voice disconnect and external move handling

An admin can disconnect (voice-kick) or drag the bot to another voice channel. The bot detects its own `voiceStateUpdate`, ends the session on disconnect, and follows the move without interrupting playback. External disconnects are handled in `voiceStateUpdate` rather than on the `VoiceConnection`'s `Disconnected` state to avoid false positives from transient network blips.

## Context

`voiceStateUpdate` at `src/events/voiceStateUpdate.ts` previously only called `Player.refreshVoiceMembership()` for the grace-period timer (ADR-0005). It ignored `oldState` and never checked whether the state change belonged to the bot itself (`newState.id === bot.user.id`). If an admin used "Disconnect" or dragged the bot, the `Player` kept its stale `channel`, queue, and registry entry — `isConnected` went to `false` but no cleanup fired and the grace timer could not arm.

`DiscordVoicePort` at `src/voice/DiscordVoicePort.ts:63` forwards `VoiceConnectionStatus.Disconnected` but only logs. Wiring `Player` to `port.on("stateChange")` (`src/voice/Player.ts:115`) to call `endSession()` on `Disconnected` would catch the kick, but `Disconnected` also fires on transient network/WS/UDP blips where `@discordjs/voice` will reconnect (`Connecting` → `Ready`). Ending the session immediately would kill playback on every blip — a false positive. Correct `port`-based handling needs a delayed race (wait ~5s, re-check), which is more complex and still duplicates the authoritative signal Discord already sends.

## Decision

- **Disconnect/kick is handled in `voiceStateUpdate`, not on the port.** When `newState.id === bot.user.id && newState.channelId === null`, the guild's `Player` calls `endSession()` (`src/voice/Player.ts:388` — `leave()` + `queue.clear()` + `port.destroy()` + `onSessionEnd`). This is the same single end-of-session path the grace timer and Stop button use, so teardown stays consistent and no extra `VoiceConnection` state machine is needed.
- **External move is followed, not ended.** When `newState.id === bot.user.id && oldState.channelId !== newState.channelId && newState.channelId !== null`, the `Player` calls `handleExternalMove(channel)` (`src/voice/Player.ts`). The method updates `Player.channel` to the new `VoiceChannel` and re-evaluates the grace timer via `refreshVoiceMembership()`. No `port.join()`/`rejoin()` is needed.
- **Why playback resumes without action:** the `AudioPlayer` is subscribed to the guild's `VoiceConnection` (`src/voice/DiscordVoicePort.ts:89` `connection.subscribe(audioPlayer)`), not to a channel. Moving channels does not destroy the connection or the player — the current `Recitation`/`Radio` `resource` keeps streaming. Only the `Player`'s bookkeeping (which `VoiceChannel.members` to count for the grace period, and `voiceChannelId` for the panel) needs to follow the new channel.

## Considered Options

- **End the session on `port` `VoiceConnectionStatus.Disconnected` immediately** — rejected: `Disconnected` is noisy (any drop triggers it). The library is expected to reconnect automatically; immediate teardown would end sessions on recoverable blips.
- **`Disconnected` with a delayed check (5s, re-check `Ready`)** — rejected as primary: viable as a fallback if `voiceStateUpdate` were ever missed, but unnecessary complexity when Discord's own voice state for the bot is the authoritative signal for kick/move.
- **Ignore external moves (keep old `channel`)** — rejected: `refreshVoiceMembership()` would keep reading the old channel's `members`, so the grace timer would track the wrong room and the panel's `voiceChannelId` would be stale.

## Consequences

- A voice-kicked bot cleans up immediately: queue cleared, connection destroyed, registry entry removed via `onSessionEnd`, panel disabled — same as Stop/grace expiry.
- A dragged bot keeps playing uninterrupted in the new channel; the grace timer now tracks humans in the new channel. If the new channel is empty, the timer arms as normal.
- `voiceStateUpdate` remains the single voice-membership entry point; `Player.port.on("stateChange")` stays a pure `connectionState` mirror (`src/voice/Player.ts:115`), avoiding false-positive teardown.
- Tested via `Player.handleExternalMove` and the `voiceStateUpdate` bot-id branch; no new `VoicePort` surface needed because the move is a `Player` bookkeeping update, not a voice-layer reconnect.

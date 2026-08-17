# Grace-period leave and the session lifecycle

The Player ends a [voice] session automatically when its channel empties of humans: a configurable grace timer starts once the last human leaves, a human returning before it fires cancels it, and if it fires the Player disconnects, clears the Queue, and is disposed from the registry. Session end is a single action; `/leave` is dropped as a standalone command.

## Context

A Player that stays connected forever would idle in an empty voice channel, holding the connection and its queue. The bot needs to leave on its own, but a hard disconnect on the last leave is punishing — a user who briefly steps out would have their session killed. So the end is deferred by a short grace window.

There are also two ways a session can end: the user pressing the panel's **Stop** button and the grace timer firing. They must behave identically (disconnect, clear the Queue, dispose the Player, drop the panel), which argues for one shared end-of-session action rather than two divergent teardown paths.

## Decision

- The **Player watches voice-channel membership**: Discord's `voiceStateUpdate` event is routed to each connected Player, which recomputes how many humans (non-bot members) are in its channel.
- When that count drops to **0**, a **grace timer** starts (default 60s, configurable via `GRACE_PERIOD_MS` / `src/config`). If a human returns before it fires, the timer is **cancelled and nothing else happens**.
- When the timer **fires**, the Player ends the session: disconnect, clear the Queue, and dispose itself from the registry via an injected `onSessionEnd` hook.
- **`endSession()`** is the single end-of-session action, shared by the grace timer and the panel's **Stop button**. The panel disabling (from #18) hooks into the same path.
- **`/leave` is removed** as a standalone command; the Stop button covers ending a session manually.

## Considered Options

- **Leave immediately on the last human leaving** — rejected: punishes a user who briefly steps out, and provides no way to recover.
- **Unbounded stay (no timer)** — rejected: idles the connection and its queue indefinitely.
- **Keep `/leave` alongside the grace timer** — rejected: two surfaces for the same action, and the panel's Stop button is the natural home for it.

## Consequences

- Voice-membership watching and the timer live in the Player behind a method (`updateVoiceMembership`) that is testable with fakes and mock timers — no real Discord required.
- The grace period is centralized in `src/config` and surfaced in `.env.example` (`GRACE_PERIOD_MS`).
- The Player reports membership to itself on every `voiceStateUpdate` via `refreshVoiceMembership`, keeping Discord's voice-state caching behind the Player.
- Session-end teardown (including the future panel disabling) travels through `endSession`, so all end paths stay consistent.
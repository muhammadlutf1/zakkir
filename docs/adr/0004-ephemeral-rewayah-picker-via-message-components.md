# Ephemeral Rewayah picker via message components

`/play` shows the Rewayah picker as an ephemeral message with one Play button per available Rewayah, routed through a `Component`-style message-component handler.

## Context

When a `/play` request has a real Rewayah choice (more than one covers the Surah, or the resolved default doesn't), the bot needs a lightweight way to ask the user to pick without a second round-trip to the command. The picker must be ephemeral, time out on its own (auto-play the default or cancel), and be handled by the same component-dispatch machinery as future panels.

## Decision

- The picker is an **ephemeral** message with a Play button per Rewayah. Ephemeral keeps the interaction scoped to the invoking user and avoids clutter.
- Each button carries a `rewayah-play:<surah>:<reciter>:<rewayah>` customId, parsed back into a `RewayahChoice`.
- The picker is handled by a **message component** (`Component`) rather than a second slash command, so dispatch reuses the component pipeline.
- A **30s timeout** (configurable in `src/config`) auto-plays the resolved default Rewayah, or posts an ephemeral "nothing picked" notice when no default exists.

## Considered Options

- **A follow-up select menu** — rejected: still requires the user to pick, and the ephemeral-button approach is simpler to render and parse.
- **Auto-playing the first Rewayah** — rejected: silently picking a non-default Rewayah would surprise the user.
- **A dedicated command** for choosing — rejected: adds surface area; message components are the natural fit for a UI that appears mid-flow.

## Consequences

- The component pipeline (loader, `Bot.components`, `interactionCreate` dispatch) is the delivery path for pickers and future panels (e.g. PlayerPanel buttons).
- The picker message must be remembered for timeout cleanup; cancellation is keyed by the message id.
- The timeout default and the picker's ephemeral behavior are centralized in `src/config` and the picker module, so both stay consistent.

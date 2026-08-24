# Zakker Bot

A Discord bot that registers slash commands and event handlers at startup, then dispatches incoming interactions to the registered commands.

## Language

**Bot**:
The Discord client instance that owns the loaded commands and events and manages the client lifecycle (login, ready).
_Avoid_: Client, client instance

**Command**:
A slash command the bot exposes, with a definition (name and options) and an `execute(bot, interaction)` behavior.
_Avoid_: SlashCommand, command handler

**BotEvent**:
A registered Discord event handler with a name, an optional `once` flag, and an `execute(bot, ...args)` behavior.
_Avoid_: Event handler, handler, listener

**Loader**:
The mechanism that reads files from the `commands/` and `events/` directories and registers each valid one into the Bot's collections.
_Avoid_: importer, registrar

**Dispatcher**:
The BotEvent that routes an incoming interaction to the matching Command (and Component, e.g. PlayerPanel buttons) and handles command execution errors.
_Avoid_: handler, router

**Component**:
A Discord message-component interaction handler (button or select menu) with a customId and an `execute(bot, interaction)` behavior — the widget counterpart to a Command.
_Avoid_: button handler, widget, component handler

## Voice

**Player**:
One per guild. Owns that guild's voice connection and audio playback — joins/leaves voice channels, and feeds tracks from its Queue to the audio player as each one finishes. When the last human leaves its voice channel it starts a configurable grace timer; if nobody returns before it fires, the session ends — the Player disconnects, clears the Queue, and is disposed from the registry. The Stop button and the grace timer share this end-of-session action; `/leave` is not a standalone command.
_Avoid_: VC manager, audio player manager, guild player

**PlayerPanel**:
One per guild. Renders the Player's state to a Discord message (a Components V2 Container with action components) and re-edits that same message in place as playback state changes, so the panel stays the single live view of the session.
_Avoid_: player card, now-playing message, player message

**Queue**:
One per guild. The ordered list of tracks a Player plays, supporting add, remove, skip, and clear operations. Owns the RepeatMode.
_Avoid_: playlist, song list, queue manager

**RepeatMode**:
The Queue's looping behavior: OFF (advance and end), CURRENT (replay the current Recitation), or ALL (wrap back to the first when the queue ends). The Player's auto-advance follows the current mode.
_Avoid_: loop mode

**PlayerRegistry**:
The bot-wide map from guild id to that guild's Player, created lazily when the Player first joins.
_Avoid_: voice manager, player manager

**Recitation**:
The queue's unit of playback — a Surah read by a Reciter in a specific Rewayah. A finite track that ends, which the Player auto-advances past.
_Avoid_: track, song, audio file

**Surah**:
One of the 114 chapters of the Quran, identified by name or number.
_Avoid_: chapter

**Reciter**:
A reciter whose readings are streamable through the Catalog. A Reciter has one or more Rewayat (sometimes none available for a given Surah).
_Avoid_: reader, qari

**Rewayah**:
A recitation method (e.g. Hafs) that a Reciter provides. A Rewayah has a server base URL and covers a set of Surahs (which may be empty for a given Reciter/Surah pairing).
_Avoid_: moshaf, rewaya

**GuildConfig**:
A guild's persisted preferences: language (the bot UI's display language), default Reciter, and default Rewayah. The UI language is read directly; the default Reciter and default Rewayah resolve playback defaults when a command omits them.
_Avoid_: ServerSettings, GuildSettings, GuildPreferences

**Radio**:
An endless streaming channel the Player can play instead of the Queue. Exclusive — while a Radio plays, recitations can't start; the Queue is paused, not cleared, and resumes when the Radio ends.
_Avoid_: station, live stream, radio station

**Catalog**:
The client that resolves Reciter/Surah/Radio names and numbers to stream URLs, via the MP3Quran API. Its endpoint data is cached per Locale with bounded freshness and served from memory; the Dispatcher puts a Catalog bound to the guild's Locale on the interaction context.
_Avoid_: API client, radio API, Quran API

## Play

**PlayOutcome**:
The result of resolving a `/play` request — either a ready `play` Recitation, a `picker` showing the Rewayah choices, or an `error` message.
_Avoid_: play result, resolution

**RewayahChoice**:
A single Rewayah the picker offers for a Surah (Reciter + Rewayah identity), resolved to a full Recitation only when the user picks it or the picker auto-plays it on timeout.
_Avoid_: option, picker entry

**RewayahPicker**:
The ephemeral message shown when `/play` needs the user to choose a Rewayah (more than one covers the Surah, or the default doesn't). One Play button per Rewayah; a 30s timeout auto-plays the resolved default or cancels when none exists.
_Avoid_: riwayat list, choice menu

**PlayOutcome resolution**:
Resolving a `/play` request — which Reciter plays the given Surah via option > GuildConfig > global default, then which Rewayah. A single Rewayah (or a covering default) plays directly; otherwise the picker shows.
_Avoid_: command logic

**Notice channel**:
The text channel where a guild's Player posts user-facing notices (e.g. a failed Recitation). Set to the channel of the guild's most recent `/play`.
_Avoid_: notification channel

## Localization

**Locale**:
The language a guild's UI renders in, resolved from the guild's saved `language` via `GuildConfig.language` with English as the bot-wide default. A `Localizable` translator bound to the locale resolves every user-facing message through the catalog.
_Avoid_: language, lang, translation

**Message key**:
The identifier in the message catalog (e.g. `notice.unreachable`) that maps to the string a user-facing site renders. The English catalog defines the full set of keys; every other locale covers the same set, enforced by `as const satisfies MessageCatalog`.
_Avoid_: string id, translation key, text key

**Config command**:
The slash command that persists a guild's preferences through the guild-config layer, including its UI language — the `/preferences` command (`language`, `default-reciter`, `default-rewayah` subcommands). A language change applies to the live Player by swapping its injected notice formatter rather than teaching the Player about locales.
_Avoid_: settings command, preferences command, guild settings

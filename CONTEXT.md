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
The BotEvent that routes an incoming interaction to the matching Command and handles command execution errors.
_Avoid_: handler, router

## Voice

**Player**:
One per guild. Owns that guild's voice connection and audio playback — joins/leaves voice channels, and feeds tracks from its Queue to the audio player as each one finishes.
_Avoid_: VC manager, audio player manager, guild player

**Queue**:
One per guild. The ordered list of tracks a Player plays, supporting add, remove, skip, and clear operations.
_Avoid_: playlist, song list, queue manager

**PlayerRegistry**:
The bot-wide map from guild id to that guild's Player, created lazily when the Player first joins.
_Avoid_: voice manager, player manager

**Recitation**:
The queue's unit of playback — a Surah read by a Reciter. A finite track that ends, which the Player auto-advances past.
_Avoid_: track, song, audio file

**Surah**:
One of the 114 chapters of the Quran, identified by name or number.
_Avoid_: chapter

**Reciter**:
A reciter whose readings are streamable through the Catalog. A Reciter's reading style is a moshaf with a server base URL.
_Avoid_: reader, qari

**Radio**:
An endless streaming channel the Player can play instead of the Queue. Exclusive — while a Radio plays, recitations can't start; the Queue is paused, not cleared, and resumes when the Radio ends.
_Avoid_: station, live stream, radio station

**Catalog**:
The client that resolves Reciter/Surah names and numbers to stream URLs, via the MP3Quran API.
_Avoid_: API client, radio API, Quran API

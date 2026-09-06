<p align="center">
  <img src="assets/pfp.png" alt="Zakkir logo" width="220" />
</p>

<h1 align="center">Zakkir - ذَكِّرْ</h1>

<p align="center">
  A Discord bot for streaming Quran recitations, radio, and more directly in your voice channel.
</p>

<p align="center">
  <a href="https://discord.com/oauth2/authorize?client_id=1304568233747157002">
    <img alt="Invite Zakkir" src="https://img.shields.io/badge/Invite-7289da?style=for-the-badge&logo=discord&logoColor=white">
  </a>
  <a href="https://discord.gg/84m6HgHcEB">
    <img alt="Support Server" src="https://img.shields.io/badge/Support-5865f2?style=for-the-badge&logo=discord&logoColor=white">
  </a>
</p>

Zakkir connects to voice, resolves recitations through the [MP3Quran API](https://mp3quran.net), and keeps a per-guild player with queue, repeat modes, a live panel, and a vote system for privileged actions. Localized in English and Arabic out of the box.

---

## Features

- ✨ **User friendly and Modern** - Built on Discord's latest interactions, autocomplete, and components for a seamless and interactive experience.

- 🧩 **Easy to Use** - No complicated setup. Just invite the bot and you are ready to go.

- 🕌 **Massive Content Library** powered by the trusted [MP3Quran API](https://www.mp3quran.net/eng/api):
  - 🎧 **170+ Quran radio stations** from across the Muslim world
  - 🗣️ **230+ reciters** with multiple rewayat where available
  - 📖 All **114 Surahs** with name and number search

- 🎛️ **Queue and Controls** - Add, skip, remove, clear, jump to any track, pause and resume, and choose a repeat mode (Off, Current, or All).

- 🖥️ **Live Player Panel** - A single message per server that stays in sync with playback, with inline controls for everyone in voice.

- 📻 **Radio Mode** - Play an endless radio station. Your queue is paused, not lost, and resumes when the radio ends. Switching between queue and radio asks for confirmation.

- ⚙️ **Server Preferences** - Set your server's language, default reciter, and default rewayah with `/preferences`. Saved per server.

- 🌐 **English and Arabic** - Every message is localized. Change the server language anytime and the bot adapts immediately.

- 🗳️ **Fair Voting** - Sensitive actions like skipping or clearing can be voted on. Votes track who is in voice in real time, resolve early when the outcome is clear, and timeout after 20 seconds.

- 🔓 **Self-Hostable** - Run your own instance in minutes. Fork the repo, set your bot token, and customize anything - commands, languages, or features - to make it truly yours.

## Quick Start

### Prerequisites

- Node.js 22+
- pnpm 11.3+
- A Discord application and bot token ([Discord Developer Portal](https://discord.com/developers/applications))

### Setup

```bash
# 1. Clone and install
git clone https://github.com/<owner>/zakkir.git
cd zakkir
pnpm install

# 2. Configure environment
cp .env.example .env
# edit .env and set BOT_TOKEN and CLIENT_ID (required)

# 3. Deploy slash commands to Discord
pnpm run deploy:commands

# 4. Start in development mode (watch)
pnpm run dev
```

### Environment Variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `BOT_TOKEN` | Yes | - | Discord bot token |
| `CLIENT_ID` | Yes | - | Discord application (client) ID |
| `DATABASE_PATH` | No | `data/zakkir.db` | SQLite database path |
| `GRACE_PERIOD_MS` | No | `60000` | Grace period before ending a session after the last human leaves (ms) |
| `LOG_LEVEL` | No | `info` | Pino log level (`debug`, `info`, `warn`, `error`) |

### Production Build

```bash
pnpm run build
pnpm run start
```

## Commands

| Command | Description |
|---|---|
| `/play <surah> [reciter]` | Play a Surah recitation (autocomplete for both fields) |
| `/radio <station>` | Play a live radio station |
| `/skip` | Skip the current recitation |
| `/remove <position>` | Remove a queued recitation by position |
| `/clear` | Clear the queue |
| `/repeat <mode>` | Set repeat mode (`off` / `current` / `all`) |
| `/panel` | Show or refresh the player panel |
| `/join` | Make the bot join your voice channel |
| `/preferences list` | Show current server preferences |
| `/preferences language <locale>` | Set UI language (`en` / `ar`) |
| `/preferences reciter <reciter>` | Set default reciter |
| `/preferences rewayah <rewayah>` | Set default rewayah |

## Self-Host Your Own Instance

Want full control? Self-hosting lets you run a private copy with your own bot token and tweak anything you like.

```bash
# Fork or clone your fork
git clone https://github.com/<your-fork>/zakkir.git
cd zakkir
pnpm install
cp .env.example .env
# set BOT_TOKEN and CLIENT_ID for your own Discord application
pnpm run deploy:commands
pnpm run build && pnpm run start
# or pnpm run dev for local development
```

You can customize reciters, add translations, change defaults in `src/config/index.ts`, or extend commands. See [CONTRIBUTING.md](CONTRIBUTING.md) for development guidelines.

## Configuration

Server defaults are resolved in order: **command option, then server default from `/preferences`, then global default** (`src/config/index.ts`). The catalog of reciters, rewayat, and radios is cached per locale with a 24h TTL and 1h failure cooldown.

See [`src/config/index.ts`](src/config/index.ts) for all tunable values such as catalog TTL, fetch attempts, picker timeout, and voice grace period.

## Architecture

```
src/
├── access/       # Gate and VoteManager for access control
├── catalog/      # Catalog client (MP3Quran API) and Surah list
├── commands/     # Slash command definitions (/play, /radio, /preferences, etc.)
├── components/   # Component handlers (buttons, selects, vote, player panel)
├── core/         # Bot, loaders, dispatcher (interactionCreate), logger
├── events/       # Event handlers (ready, voiceStateUpdate, etc.)
├── guild/        # GuildConfig and SQLite persistence
├── i18n/         # Locale, translator, and message catalogs (en/ar)
├── play/         # PlaybackRequest, player panel, playback notices
├── voice/        # Player, Queue, PlayerRegistry, VoicePort
└── scripts/      # deployCommands.ts
```

Key concepts are defined in [`CONTEXT.md`](CONTEXT.md) - Player, Queue, Recitation, Catalog, Locale, Gate, Vote, and more.

## Tech Stack

- [discord.js](https://discord.js.org/) `^14` with [@discordjs/voice](https://github.com/discordjs/discord.js) for Discord API and voice
- [pino](https://github.com/pinojs/pino) for structured logging
- [Biome](https://biomejs.dev/) for linting and formatting
- [esbuild](https://esbuild.github.io/) for production builds
- [tsx](https://github.com/privatenumber/tsx) for dev and tests

## Contributing

We welcome contributions of all kinds: code, bug reports, ideas, translations, and feedback. See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines, commit conventions, and how to help without writing code.

## License

[MIT](LICENSE)

# GuildConfig is persisted in SQLite, unlike the in-memory Queue

Guilds get a persisted GuildConfig (language, default Reciter, default Rewayah) stored in a local SQLite database and cached in memory after first load (ADR-0003). This deliberately contrasts with the Queue, which is in-memory only (ADR-0002): a guild's explicit preference choices are low-volume, high-surprise-if-lost data that users set and expect to stick across restarts, whereas Queue state is ephemeral playback state that crash-proofing (not durability) protects.

## Considered Options

- **SQLite file** — small, zero-ops, survives restarts, portable. Chosen. A single user-configured SQLite dependency (plus in-memory caching) for readiness/reads; changes survive restarts.
- **JSON file per guild / flat-file store** — also survives restarts but lacks atomicity and simple querying/caching invalidation; SQLite gives us both for free.
- **In-memory only (mirroring the Queue)** — rejected: guild defaults would silently reset on every restart, which is precisely the surprise the Queue's ephemerality explicitly accepts but config data must not.

## Consequences

- The bot needs one SQLite dependency (and a wrapper for the GuildConfig read/cache path).
- GuildConfig survives restarts; Queue state does not — the two persistence decisions are intentional and distinct.
- Defaults resolution stays a pure typed API; the store is swappable behind the GuildConfig class if SQLite is ever outgrown.
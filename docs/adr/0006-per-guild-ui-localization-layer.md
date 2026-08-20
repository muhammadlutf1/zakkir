# Per-guild UI localization layer

Every user-facing string the bot renders is resolved per guild: each guild has an effective UI **locale**, and every rendering site (slash-command replies, component replies, Player notices, the future rewayah picker and `/preferences` surfaces) derives its wording from that locale through a shared message catalog. Localization is a distinct layer between the guild's persisted config and the surfaces that render text, so no surface owns translation logic.

## Context

A guild can be Arabic- or English-speaking, and a single user may use the bot across servers in different languages. Once the bot carried any per-guild settings (ADR-0003), the natural next step was to let each guild choose the language the bot speaks to it. That means every string a user sees must resolve to the guild's locale, not a bot-wide constant.

Two earlier, scattered parts of the codebase already rendered localized text (the `/play` result, the rewayah picker, the Player's failure notices) but each imported the i18n helpers directly. That leaves translation logic sitting inside the voice layer (the Player built its own Arabic/English notices) and inside command bodies, which couples surfaces to the locale machinery and makes the wording hard to change in one place. This ADR records the shape of the localization layer that replaced that scatter.

## Decision

- **Every surface asks for a bound translator.** `localizable(locale)` in `src/i18n/locale.ts` returns a `Localizable` object whose `t(key, params)` resolves a **message key** against the catalog for that locale and interpolates `{var}` placeholders. Surfaces receive this translator (from the guild's locale, via `GuildConfig.language`) instead of building translations themselves.
- **The voice layer is free of localization logic.** The Player depends on an injected `PlayerNoticeFormatter` (`src/voice/Player.ts`) — a `render(kind, recitation) → string` seam — implemented by `playbackNotices(locale)` in `src/play/playbackNotices.ts`. The Player never imports the catalog; swapping a guild's locale is expressed as swapping the injected formatter (see the `setNotices` seam) rather than teaching the Player about locales. The recitation label helper moved out of the voice layer into `src/i18n/recitationLabel.ts` for the same reason.
- **The dispatcher localizes its reactive error replies.** The interaction dispatcher resolves the guild's locale and threads a `Localizable` into `decideFailureResponse`, so the generic "There was an error…" replies render in the guild's language too.
- **Dictionary strategy: a typed, key-constant catalog.** `src/i18n/messages/en.ts` is the canonical catalog; its keys are the message set every locale must cover (`keyof typeof en`). `ar.ts` is written `as const satisfies MessageCatalog`, so the compiler enforces that Arabic covers every English key. The `Locale` union and `isLocale` narrowing guard live in `src/i18n/locale.ts`; the bot-wide `DEFAULT_LOCALE` (English) is sourced from the config's `defaults.language` in `src/config/index.ts`. Rendering sites never construct a locale from a raw string without narrowing through `isLocale`.
- **Guild-config lookups are synchronous.** `GuildConfig.language(guildId)` returns the guild's effective locale synchronously. This matches the sync `node:sqlite` driver behind the store (ADR-0003) — a local file read that never yields — and keeps every rendering site able to ask for a translator inline.

## Considered Options

- **Async guild-config reads (return `Promise<Locale>`)** — rejected: the store is a synchronous local SQLite file (ADR-0003), so forcing every rendering site to await a locale read adds `async` plumbing to surfaces that have nothing async to wait for. Sync matches the driver; async buys nothing until the store is remote.
- **Every surface imports `localizable`/`t` directly and resolves the key itself** — rejected: that was the status quo and it couples the voice layer and command bodies to the locale machinery, scatters translation logic, and makes locale-swap (a guild changing language at runtime) harder than exchanging one injected formatter.
- **One bot-wide language constant** — rejected outright: the whole point is per-guild UI language; a single constant cannot serve Arabic and English guilds on the same bot.
- **A runtime dynamic-key catalog (e.g. a plain `Record<string, string>` looked up by string)** — rejected: losing `keyof typeof en` forfeits the compile-time guarantee that every locale covers every key, which is the primary safety of the dictionary strategy.

## Consequences

- **Where localization lives:** `src/i18n/` owns the catalogs, the `Localizable` translator, and the localized recitation label; `src/play/` owns the Player's injected notice formatter; command bodies and the dispatcher receive translators rather than building them.
- **Adding a locale:** add its dictionary file, export it from `src/i18n/messages/index.ts`, add it to `LOCALES`/`Locale`/`catalogs`, and the `as const satisfies MessageCatalog` check forces it to cover every English key.
- **Adding a message:** add the key to `en.ts` (the canonical set) and to every other locale; TypeScript flags any locale that misses it.
- **Changing a guild's language at runtime:** resolve the new locale via `GuildConfig.language` and swap the injected `PlayerNoticeFormatter` (via `setNotices`) — the Player and other surfaces need no locale-aware state of their own.
- **Trade-off accepted:** the `t(...)` helper leaves a placeholder with no matching param visible in the output rather than blanking it, so a missing value is loud in review instead of silently gone.

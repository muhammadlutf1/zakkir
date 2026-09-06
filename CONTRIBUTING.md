# Contributing to Zakkir

Thank you for considering a contribution. Whether it is code, a bug report, an idea, a translation, or just feedback, it all moves the project forward.

> [!NOTE]
> By participating you agree to be respectful and constructive. Be kind, assume good intent, and keep discussion focused on the work.

## Ways to Contribute

You do not need to write code to help.

### Report Bugs

Found something broken? [Open a bug report](../../issues/new?template=bug_report.yml) with a clear reproduction. The more precise the steps, the faster it gets fixed. Check existing issues first to avoid duplicates.

### Suggest Features

Have an idea? [Request a feature](../../issues/new?template=feature_request.yml). Describe the problem it solves, who it helps, and any alternatives you have considered. Small, focused proposals are easier to act on.

### Improve Localization

Zakkir ships `en` and `ar`. Every user-facing string lives in `src/i18n/messages/<locale>.ts` and is type-checked against the English catalog. You can help by:

- Fixing awkward or incorrect translations.
- Adding a new locale: copy `src/i18n/messages/en.ts` to `<locale>.ts`, translate every key (`as const satisfies MessageCatalog` will enforce coverage), and register it in `src/i18n/locale.ts` (`LOCALES` and `catalogs`).
- Reviewing translations if you are a native speaker.

Open an issue first when adding a new locale so we can coordinate.

### Give Feedback

Using the bot on your server? Feedback on UX, command design, the player panel or vote flow is valuable even without a concrete proposal. Open a plain issue or start a discussion and describe what felt confusing or delightful.

### Answer Questions

Help others by answering questions in issues, reproducing reported bugs, or confirming that a fix works. A well-written reproduction is a contribution in itself.

### Write Code

Pick an open issue or open one to discuss your idea before building. See the workflow below.

## Development Setup

```bash
git clone https://github.com/<owner>/zakkir.git
cd zakkir
pnpm install
cp .env.example .env   # fill in BOT_TOKEN and CLIENT_ID
pnpm run deploy:commands
pnpm run dev           # watch mode
```

| Script | What it does |
|---|---|
| `pnpm run dev` | Run the bot with `tsx --watch` |
| `pnpm run build` | Production build via esbuild to `dist/` |
| `pnpm run start` | Run the built bot |
| `pnpm test` | Run tests (`tsx --test`) |
| `pnpm lint` | Check with Biome (warnings fail) |
| `pnpm run lint:fix` | Auto-fix lint issues |
| `pnpm exec tsc --noEmit` | Typecheck |

### Before You Submit

Run all four quality gates locally. CI enforces the same:

```bash
pnpm lint
pnpm exec tsc --noEmit
pnpm test
pnpm build
```

All four must pass. Biome warnings fail lint, so run `pnpm run lint:fix` if needed.

## Project Conventions

### Code Style

- **Formatting and linting** are enforced by [Biome](https://biomejs.dev/) (`biome.json`). Tabs for indentation. Fix before pushing.
- **TypeScript** is strict. Do not add return types that inference can handle. Annotate only when the inferred type would be inaccurate or unnamed. See `AGENTS.md`.
- Never use `as unknown as` double-casts in `src/`. Use proper narrowing (`is*` guards, `instanceof`, `in`), a single `as` with a `// SAFETY:` comment, or a typed helper.
- Follow the domain vocabulary in [`CONTEXT.md`](CONTEXT.md): Player, Queue, Recitation, Catalog, Locale, Gate, Vote, etc. Avoid the listed anti-terms.

### Commit Conventions

We use [Conventional Commits](https://www.conventionalcommits.org/). This keeps history readable and powers automated changelogs.

```
<type>(<scope>): <short summary>

[optional body]

[optional footer]
```

**Types:**

| Type | Use |
|---|---|
| `feat` | New feature |
| `fix` | Bug fix |
| `docs` | Documentation only |
| `style` | Formatting, whitespace, no logic change |
| `refactor` | Code change that neither fixes a bug nor adds a feature |
| `perf` | Performance improvement |
| `test` | Adding or updating tests |
| `build` | Build system or external dependencies |
| `ci` | CI configuration |
| `chore` | Other maintenance |
| `i18n` | Localization and translations |

**Scopes** are optional but encouraged. Use the area touched: `player`, `queue`, `catalog`, `i18n`, `commands`, `vote`, `panel`, `config`, etc.

**Examples:**

```
feat(play): add autocomplete for rewayah picker
fix(player): cancel grace timer when bot is moved externally
docs(readme): clarify environment variables
i18n(ar): fix repeat-mode labels in player panel
chore: bump discord.js to 14.28
```

**Rules:**

- Use imperative mood in the summary ("add" not "added" or "adds").
- Keep the summary under about 72 characters.
- Write the body to explain why, not just what, when the reason is not obvious.
- Reference issues in the footer with `Closes #123` or `Refs #123`.
- One logical change per commit. Split unrelated changes.

## Pull Request Process

1. **Fork** the repo and create a branch from `main`. Name it `feat/<short-name>` or `fix/<short-name>`.
2. **Keep PRs focused**. One feature or fix per PR. Smaller PRs get reviewed faster.
3. **Write a clear description**: what changed, why, and how to verify. Link the related issue.
4. **Pass CI**. Lint, typecheck, test, and build must all be green.
5. **Be responsive**. Address review feedback with new commits (do not force-push during review unless asked).

> [!TIP]
> For larger changes, open an issue or draft PR early to get feedback on the approach before you invest too much.

## Reporting Issues Well

A good issue saves everyone time:

- **Search** existing issues before opening a new one.
- **One issue per bug or request**. Do not bundle unrelated items.
- For bugs: include steps to reproduce, expected vs actual behavior, bot version or commit, and relevant logs.
- For features: describe the problem and the proposed solution, and note alternatives.

## Questions?

Open an issue with your question, or reach out via the repository Discussions tab. We are happy to help you get started.

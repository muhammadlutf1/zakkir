# Quality gates (lint / typecheck / test / build)

Run the full gate before considering any work "done" — and always before committing. A change is only finished when all four pass. Do not hand off, open an issue as ready, or create a PR while the gate is red.

## The gate

```sh
pnpm lint          # Biome check (formatter + linter + assist), errors and warnings both fail (--error-on-warnings)
pnpm exec tsc --noEmit   # TypeScript typecheck
pnpm test          # node:test suite (all must pass)
pnpm build         # esbuild bundle must succeed
```

Common shorthand when reviewing a touched scope: run `pnpm exec biome check <file>` on the files you changed, but always finish with the full `pnpm lint` + `tsc` + `test` + `build` before committing.

Format-only shorthands: `pnpm format` (`biome format`) and `pnpm format:fix` (`biome format --write`); `pnpm lint:fix` runs `biome check --write` to fix formatter + linter + assist in one pass.

Use **pnpm only** (the repo's `devEngines` pins pnpm; do not run npm).

## Biome configuration

Config lives in `biome.json` at the repo root. Notable points:

- `biome.json` has `formatter.enabled: true` with `indentStyle: "tab"` (project uses tabs). `pnpm lint` runs `biome check --error-on-warnings ./src ./__tests__` — formatter + linter + assist in one pass. **Warnings fail the build**, unlike Biome's default where warnings are tolerated.
- **`noFloatingPromises` and `noMisusedPromises` are enabled at `error`** (correctness group in other Biome versions; here they live in the **`nursery`** group, so they're configured under `linter.rules.nursery`). Any Promise that isn't awaited, `.catch`-ed, or explicitly `void`-ed is a lint error. The entrypoint `src/index.ts` handles its rejection via `try { await bot.login() } catch` — keep that pattern; never fire-and-forget a top-level promise that can reject.
- **`noNonNullAssertion` stays ON in `src/`** (a real safety net there) but is **OFF under `__tests__/`**, where `assert.ok(x)` followed by `x!` is intentional test idiom. If you add a non-null assertion in production code, expect lint to fail — prefer a guard or explicit check.
- If `pnpm lint` is red, fix the code — do not weaken the config (e.g. don't silently downgrade a rule to "warn" or add broad `// biome-ignore` comments).

## History / why this exists

Added while deepening the interaction layer (#22 / PR #24). The refactor's whole point was to make the interaction layer testable through narrow seams, so the gate exists to keep that testable surface honest: fixed rule set, strict on warnings, and a verified typecheck/test/build before anything lands.
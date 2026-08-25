## Coding preferences

- Don't specify return types that TypeScript can infer (e.g. `: void`, `: number`, `: boolean`). Only annotate where inference wouldn't be accurate or the type isn't otherwise named.
- Never use `as unknown as` double-casts in `src/` — use proper narrowing (`is*` guards, `instanceof`, `in`), a single `as` with a `// SAFETY:` comment explaining why, or a typed helper. The `anti-slop/no-chained-type-assertions` oxlint rule enforces this.

## Agent skills

### Issue tracker

Issues are tracked in this repo's GitHub Issues, via the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

The five canonical triage labels are used as-is (needs-triage, needs-info, ready-for-agent, ready-for-human, wontfix). See `docs/agents/triage-labels.md`.

### Domain docs

Single-context layout — root `CONTEXT.md` + `docs/adr/`. See `docs/agents/domain.md`.

### Pull requests

Create PRs with `gh`, and write the body via `--body-file` from a temp file — inline `--body` strings in PowerShell leave literal `\` escapes in the markdown. See `docs/agents/pull-requests.md`.

### Quality gates

Run `pnpm lint`, `pnpm exec tsc --noEmit`, `pnpm test`, and `pnpm build` before finishing any work — all four must pass, and warnings fail lint. Biome rules and the full workflow live in `docs/agents/quality-gates.md`.

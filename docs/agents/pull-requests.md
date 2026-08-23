# Creating pull requests

PRs are created with the `gh` CLI. Body text is written as GitHub-flavored Markdown.

## Write the body from a file, not an escaped inline string

When the body contains backticks, hash signs, or other Markdown/foreground characters, do **not** pass it inline to `gh pr create/edit --body "..."`.

Different shells escape differently (PowerShell, for example, does not treat `\`` or `\#` as escapes — the backslash passes through literally and the resulting PR body ends up full of `\` garbage). This bit us in #16.

Instead, write the body to a temp file and pass it with `--body-file`, then delete the temp file once the PR is uploaded. Use the OS temp directory or any location outside the workspace for these throwaway files, and always remove them afterwards.

**Linux / macOS (bash/zsh):**

```sh
bodyFile=$(mktemp)

# write the markdown body to "$bodyFile" ...

gh pr create --base main --head my-branch --title "feat(...): ..." --body-file "$bodyFile"

rm "$bodyFile"
```

Same for edits:

```sh
bodyFile=$(mktemp)

# write the markdown body to "$bodyFile" ...

gh pr edit 16 --body-file "$bodyFile"

rm "$bodyFile"
```

**Windows (PowerShell):**

```powershell
$bodyFile = Join-Path ([System.IO.Path]::GetTempPath()) "pr-body.md"

# write the markdown body to $bodyFile ...

gh pr create --base main --head my-branch --title "feat(...): ..." --body-file $bodyFile

Remove-Item -LiteralPath $bodyFile
```

Same for edits:

```powershell
$bodyFile = Join-Path ([System.IO.Path]::GetTempPath()) "pr-body.md"

# write the markdown body to $bodyFile ...

gh pr edit 16 --body-file $bodyFile

Remove-Item -LiteralPath $bodyFile
```

## PR conventions

- Link the originating issue in the body (`Closes #N` for a fix/feature issue, `Closes #N` + `refs` for partial work).
- Follow the repo's commit style for the title: `type(scope): subject` (e.g. `feat(catalog): ...`, `refactor(voice): ...`).
- Section headers (`## What`, `## Tests`) keep the body scannable in the GitHub UI.
- Include verification output (typecheck / test counts) so reviewers don't have to run it themselves.
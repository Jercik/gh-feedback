# gh-feedback

Source: https://code.j4k.dev/j4k-oss/gh-feedback. github.com/Jercik/gh-feedback is a read-only mirror; open issues and pull requests on the Forge.

Semantic CLI for pull request feedback workflow. Provides workflow-oriented commands for handling reviews, threads, and comments on the current branch's PR. The backend is chosen from the `origin` remote: GitHub (`github.com`, via `gh` + GraphQL) or Forgejo (`code.j4k.dev`, via `fgj` + REST).

## Installation

`gh-feedback` is published only as `@j4k-oss/gh-feedback` on the `code.j4k.dev` registry, which reads anonymously. The unscoped `gh-feedback` package on npmjs.org is deprecated and gets no updates.

Always map the `@j4k-oss` scope to the `code.j4k.dev` registry: without a mapping, `npm` looks on npmjs.org, finds nothing, and fails with a 404. For a one-time setup, add this line to `~/.npmrc`:

```ini
@j4k-oss:registry=https://code.j4k.dev/api/packages/j4k-oss/npm/
```

The inline flag in the commands below is enough for a single `npx` run. Keep the `~/.npmrc` line for global installs: `npm update -g` and `npm outdated -g` read the registry from your configuration, so without it they look the scoped name up on npmjs.org.

To install the command globally, first remove any old unscoped install. Both packages provide the `gh-feedback` command, so `npm install -g` stops with `EEXIST` while the old one is there:

```bash
npm uninstall -g gh-feedback
npm install -g --@j4k-oss:registry=https://code.j4k.dev/api/packages/j4k-oss/npm/ @j4k-oss/gh-feedback
```

To run it once without installing:

```bash
npx -y --@j4k-oss:registry=https://code.j4k.dev/api/packages/j4k-oss/npm/ @j4k-oss/gh-feedback@latest --help
```

To use it as a pnpm project dependency, map the scope to its registry and exempt it from `minimumReleaseAge` in `pnpm-workspace.yaml`, then add the package:

```yaml
registries:
  "@j4k-oss": https://code.j4k.dev/api/packages/j4k-oss/npm/
minimumReleaseAgeExclude:
  - "@j4k-oss/*"
```

```bash
pnpm add -D @j4k-oss/gh-feedback
```

All of these provide the same `gh-feedback` command.

## Prerequisites

- Node.js 24.15.0+
- Git repository with `origin` remote
- Git installed (`git`), with `user.name` and `user.email` configured
- For GitHub repos: GitHub CLI (`gh`) authenticated
- For Forgejo repos: the j4k `fgj` build with `pr review resolve`/`unresolve` (v0.5.0-j4k.4 or newer), authenticated

The relevant forge CLI is required only for the forge that backs `origin`; a Forgejo repo never needs `gh`, and a GitHub repo never needs `fgj`.

The j4k Forgejo fork resolves inline review conversations through the local
`fgj` CLI. `agree` and `ack` resolve settled inline conversations, while
`disagree` deliberately leaves them open for the reviewer to settle. Plain PR
comments have no hide API, so their status remains reaction-backed. Forgejo
review _bodies_ (the overall review text) are also intentionally excluded from
`summary`, because a review entity has no reaction or resolve endpoint and so
could never leave `pending`; check the forge UI for that text. Inline review
comments and PR conversation comments are surfaced and tracked normally.
`start` reopens only conversations resolved by the authenticated account; a
reviewer's resolution remains visible in `detail` and is deliberately preserved.
It changes reactions only after any required reopen succeeds. If reopening
reports an operational error, correct the cause and rerun `start`; the retry
re-reads native state, reconciling both a request that never landed and one whose
server-side reopen succeeded before the error surfaced.
If `agree` or `disagree` records its final reaction but reports an operational
completion failure, do not repeat the outcome command because that duplicates
the reply. Inspect the native anchor and retry only `fgj pr review resolve` or
`fgj pr review unresolve` when the expected transition did not land.

When one native Forgejo conversation contains several feedback items, each
item's reaction is recorded independently. `agree` and `ack` defer the shared
conversation resolution until every item is agreed or acknowledged; a
disagreed or awaiting-reply item keeps the conversation open.
Because native resolution belongs to the whole conversation, `start` or a
viewer-owned `disagree` on any finding reopens that shared conversation.
Settled siblings keep their final reactions, and the conversation resolves
again once every finding is agreed or acknowledged.
`summary --hide-resolved` hides an agreed or acknowledged item as soon as its
own final reaction is recorded, even when an unsettled sibling defers the
native conversation resolution. Disagreed and awaiting-reply findings remain
visible while their native conversation is open. A conversation resolved by
another user hides all of its findings because `start` and `disagree` preserve
that user's resolution. Plain PR comments have no conversation axis, so their
final reaction still controls that filter.

### Custom Paths

To use a specific binary (or one not in `PATH`), set:

```bash
export GH_FEEDBACK_GH_PATH=/path/to/gh
export GH_FEEDBACK_GIT_PATH=/path/to/git
export GH_FEEDBACK_FGJ_PATH=/path/to/fgj
```

For an origin that is already detected as Forgejo, override the REST API host — useful when the origin uses an SSH alias (e.g. a tailnet host) that differs from the HTTP API host:

```bash
export GH_FEEDBACK_FORGEJO_API_HOST=code.j4k.dev
```

This overrides only the API hostname. `gh-feedback` treats an origin as Forgejo only when `@j4k-oss/repoq` resolves it to the Forge (`code.j4k.dev` or its tailnet alias `code.tail.j4k.dev`), so this variable does not, on its own, enable any other instance.

`@j4k-oss/repoq` classifies every parseable non-GitHub host as a candidate Forgejo instance, so `detectProvider` in `src/lib/provider.ts` rejects any origin whose resolved API host is not the Forge's. Keep that check when upgrading `@j4k-oss/repoq`.

## Usage

```bash
# Get all PR feedback with status
gh-feedback summary

# Get TSV output for scripting
gh-feedback summary --porcelain

# Get full content of a specific item
gh-feedback detail 123456

# Mark item as work-in-progress
gh-feedback start 123456

# Mark as agreed/fixed (reply + resolve)
gh-feedback agree 123456 -m 'Fixed in commit abc123'

# Same, but read the message from stdin; stdin is read only for -f - or --interactive
printf '%s\n' 'Fixed in commit abc123' | gh-feedback agree 123456 -f -

# Heredoc for messages with special characters (backticks, $, {})
gh-feedback disagree 123456 -f - <<'EOF'
In destructuring, `const { foo: foo } = obj` is equivalent to `const { foo } = obj`.
Updated transform and added test coverage.
EOF

# Mark as disagreed/won't fix
gh-feedback disagree 123456 -m 'Intentional, see docs'

# Request clarification
gh-feedback ask 123456 -m 'Could you clarify the expected behavior?'

# Acknowledge noise (hide/resolve)
gh-feedback ack 123456

# Preview any action without executing
gh-feedback agree 123456 -m 'Fixed' --dry-run
```

## Commands

| Command                  | Description                                                   |
| ------------------------ | ------------------------------------------------------------- |
| `summary`                | Get all PR feedback with semantic status                      |
| `detail <id>`            | Fetch full untruncated content                                |
| `start <id>`             | Mark as work-in-progress (adds eyes reaction)                 |
| `agree <id> -m "..."`    | Fixed (reply + thumbs_up + resolve)                           |
| `disagree <id> -m "..."` | Won't fix (reply + thumbs_down + resolve; Forgejo stays open) |
| `ask <id> -m "..."`      | Need clarification (reply + confused)                         |
| `ack <id>`               | Acknowledge noise (rocket + hide/resolve)                     |

### Summary Output

The `summary` command outputs all PR feedback with semantic status. Status combines your reactions with resolution state:

| Status           | Meaning                                                                                                                   |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `pending`        | Needs attention (no reaction, not done)                                                                                   |
| `in-progress`    | Work started, or reactions and resolution disagree (e.g. conflicting final reactions, resolved with no final reaction)    |
| `awaiting-reply` | Asked a question (😕), not resolved; a reply does not clear it                                                            |
| `agreed`         | Fixed (👍 + hidden/resolved; on Forgejo 👍 alone, so the conversation may stay open, see [Prerequisites](#prerequisites)) |
| `disagreed`      | Won't fix (👎 + hidden/resolved; on Forgejo 👎 alone, so the conversation may stay open)                                  |
| `acknowledged`   | Noted, no action (🚀 + hidden/resolved; on Forgejo 🚀 alone, so the conversation may stay open)                           |

### Output Formats

- **TTY (default)**: Human-readable multi-line format
- **Non-TTY / `--porcelain`**: Tab-separated values (TSV) for scripting
- `--json`: Machine-readable JSON output

### TSV Columns

```
ID  TIMESTAMP  STATUS  AUTHOR  LOCATION  BODY  RESPONSES
```

## Unix Pipeline Examples

```bash
# Filter to only pending items
gh-feedback summary | awk -F'\t' '$3 == "pending"'

# Filter to items awaiting reply
gh-feedback summary | awk -F'\t' '$3 == "awaiting-reply"'

# Sort by timestamp (oldest first)
gh-feedback summary | tail -n +2 | sort -t$'\t' -k2

# Count items by status
gh-feedback summary | tail -n +2 | cut -f3 | sort | uniq -c

# Get just IDs of pending items
gh-feedback summary | awk -F'\t' '$3 == "pending" {print $1}'

# Filter items in a specific file
gh-feedback summary | awk -F'\t' '$5 ~ /src\/auth/'

# JSON output with jq (redirect stderr to suppress progress message)
gh-feedback summary --json 2>/dev/null | jq '.items[0]'
```

## Agent Rule

Add to your `CLAUDE.md` or `AGENTS.md`:

```markdown
# Rule: gh-feedback CLI Usage

`gh-feedback` is a globally available CLI. Prefer it over `gh` for PR feedback operations. Use it to get PR feedback summaries, mark items as in-progress/agreed/disagreed, request clarifications, and acknowledge feedback. Always operates on the current branch's PR.

Before first use in a session, run `gh-feedback --help` and subcommand help (e.g., `gh-feedback agree --help`) to learn available commands and options.
```

## Slash Command

A ready-made slash command is available in the repository at [`slash-command/process-feedback.md`](https://github.com/Jercik/gh-feedback/blob/main/slash-command/process-feedback.md). The prompt works with Claude Code, Cursor, and other agents that support markdown-based commands.

To install for Claude Code, download the file to your project's `.claude/commands/` directory. Then invoke with `/process-feedback`. The command systematically processes all PR feedback items: fixing issues, disagreeing with evidence, acknowledging bot noise, or requesting clarification.

## License

MIT

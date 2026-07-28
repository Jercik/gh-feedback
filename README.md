# gh-feedback

Semantic CLI for pull request feedback workflow. Provides workflow-oriented commands for handling reviews, threads, and comments on the current branch's PR. The backend is chosen from the `origin` remote: GitHub (`github.com`, via `gh` + GraphQL) or Forgejo (`code.j4k.dev`, via `fgj` + REST).

## Installation

```bash
npm install -g gh-feedback
```

## Prerequisites

- Node.js 24+
- Git repository with `origin` remote
- Git installed (`git`)
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

This overrides only the API hostname. Whether an origin is treated as Forgejo is decided by `repoq`'s host classification, so this variable does not, on its own, enable an instance whose origin host `repoq` doesn't recognize.

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

# Same, but read the message from stdin (scriptable)
printf '%s\n' 'Fixed in commit abc123' | gh-feedback agree 123456

# Heredoc for messages with special characters (backticks, $, {})
gh-feedback disagree 123456 -f - <<'EOF'
In destructuring, `const { foo: foo } = obj` is equivalent to `const { foo } = obj`.
Updated transform and added test coverage.
EOF

# Mark as disagreed/won't fix
gh-feedback disagree 123456 -m 'Intentional, see docs'

# Request clarification
gh-feedback ask 123456 -m 'Could you clarify the expected behavior?'

# Acknowledge noise (hide)
gh-feedback ack 123456

# Preview any action without executing
gh-feedback agree 123456 -m 'Fixed' --dry-run
```

## Commands

| Command                  | Description                                         |
| ------------------------ | --------------------------------------------------- |
| `summary`                | Get all PR feedback with semantic status            |
| `detail <id>`            | Fetch full untruncated content                      |
| `start <id>`             | Mark as work-in-progress (adds eyes reaction)       |
| `agree <id> -m "..."`    | Fixed (reply + thumbs_up + resolve)                 |
| `disagree <id> -m "..."` | Won't fix (reply + thumbs_down; Forgejo stays open) |
| `ask <id> -m "..."`      | Need clarification (reply + confused)               |
| `ack <id>`               | Acknowledge noise (rocket + hide)                   |

### Summary Output

The `summary` command outputs all PR feedback with semantic status. Status combines your reactions with resolution state:

| Status           | Meaning                                 |
| ---------------- | --------------------------------------- |
| `pending`        | Needs attention (no reaction, not done) |
| `in-progress`    | Being worked on (not yet resolved)      |
| `awaiting-reply` | Asked question, waiting for answer      |
| `agreed`         | Fixed (👍 + resolved)                   |
| `disagreed`      | Won't fix (👎 + resolved)               |
| `acknowledged`   | Noted, no action (🚀 + hidden)          |

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

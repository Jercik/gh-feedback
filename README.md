# gh-feedback

Semantic CLI for GitHub pull request feedback workflow. Provides workflow-oriented commands for handling reviews, threads, and comments on the current branch's PR.

## Installation

```bash
npm install -g gh-feedback
```

## Prerequisites

- Node.js 22.14+
- Git repository with `origin` remote
- GitHub CLI (`gh`) authenticated

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

| Command                  | Description                                   |
| ------------------------ | --------------------------------------------- |
| `summary`                | Get all PR feedback with semantic status      |
| `detail <id>`            | Fetch full untruncated content                |
| `start <id>`             | Mark as work-in-progress (adds eyes reaction) |
| `agree <id> -m "..."`    | Fixed (reply + thumbs_up + resolve)           |
| `disagree <id> -m "..."` | Won't fix (reply + thumbs_down + resolve)     |
| `ask <id> -m "..."`      | Need clarification (reply + confused)         |
| `ack <id>`               | Acknowledge noise (rocket + hide)             |

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

## License

MIT

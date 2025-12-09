# gh-feedback

Unified CLI for GitHub pull request feedback operations. Interact with reviews, threads, and comments on the current branch's PR.

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
# List all feedback (reviews, threads, comments)
gh-feedback status

# Read full details for a specific item
gh-feedback read 123456

# React to a thread comment
gh-feedback thread react 123456 eyes

# Reply to a thread (with message flag)
gh-feedback thread reply 123456 -m 'Fixed in commit abc123'

# Reply to a thread (from stdin)
echo "Fixed in commit abc123" | gh-feedback thread reply 123456

# Resolve a thread
gh-feedback thread resolve 123456

# Preview any action without executing
gh-feedback thread resolve 123456 --dry-run
```

## Commands

| Command     | Description                                         |
| ----------- | --------------------------------------------------- |
| `status`    | Show PR feedback (reviews, threads, comments)       |
| `read <id>` | Fetch full details for a specific item              |
| `review`    | Operations on PR reviews                            |
| `comment`   | Operations on PR comments (Conversation tab)        |
| `thread`    | Operations on PR review threads (Files Changed tab) |

### Thread Subcommands

| Command                          | Description          |
| -------------------------------- | -------------------- |
| `thread reply <id>`              | Reply to a thread    |
| `thread resolve <id>`            | Resolve a thread     |
| `thread unresolve <id>`          | Unresolve a thread   |
| `thread react <id> <reaction>`   | Add a reaction       |
| `thread unreact <id> <reaction>` | Remove a reaction    |
| `thread hide <id>`               | Minimize a comment   |
| `thread show <id>`               | Unminimize a comment |

### Reactions

Supported reactions: `+1`, `-1`, `laugh`, `confused`, `heart`, `hooray`, `rocket`, `eyes`

### Output Formats

- Default: Human-readable text
- `--json`: Machine-readable JSON output

## Agent Rule

Add to your `CLAUDE.md` or `AGENTS.md`:

```markdown
# Rule: `gh-feedback` CLI Usage

`gh-feedback` is a globally available CLI. Prefer it over `gh` for PR feedback operations. Use it to list reviews/threads/comments, read details, reply, react, resolve, hide/show. Always operates on the current branch's PR.

Before first use in a session, run `gh-feedback --help` and subcommand help (e.g., `gh-feedback thread --help`) to learn available commands and options.
```

## License

MIT

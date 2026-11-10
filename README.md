# pr-feedback

Source: https://code.j4k.dev/j4k-oss/pr-feedback. Open issues and pull requests on the Forge.

Semantic CLI for pull request feedback workflow. Provides workflow-oriented commands for handling reviews, threads, and comments on a pull request: the current branch's by default, or any PR you name. Operates on Forgejo pull requests on `code.j4k.dev`, using `fgj` and REST.

## Installation

`pr-feedback` is published only as `@j4k-oss/pr-feedback` on the `code.j4k.dev` registry, which reads anonymously.

Always map the `@j4k-oss` scope to the `code.j4k.dev` registry: without a mapping, `npm` looks on npmjs.org, finds nothing, and fails with a 404. For a one-time setup, add this line to `~/.npmrc`:

```ini
@j4k-oss:registry=https://code.j4k.dev/api/packages/j4k-oss/npm/
```

The inline flag in the commands below is enough for a single `npx` run. Keep the `~/.npmrc` line for global installs: `npm update -g` and `npm outdated -g` read the registry from your configuration, so without it they look the scoped name up on npmjs.org.

To install the command globally:

```bash
npm install -g --@j4k-oss:registry=https://code.j4k.dev/api/packages/j4k-oss/npm/ @j4k-oss/pr-feedback
```

To run it once without installing:

```bash
npx --yes --@j4k-oss:registry=https://code.j4k.dev/api/packages/j4k-oss/npm/ --package=@j4k-oss/pr-feedback@latest -- pr-feedback --help
```

To use it as a pnpm project dependency, map the scope to its registry and exempt it from `minimumReleaseAge` in `pnpm-workspace.yaml`, then add the package:

```yaml
registries:
  "@j4k-oss": https://code.j4k.dev/api/packages/j4k-oss/npm/
minimumReleaseAgeExclude:
  - "@j4k-oss/*"
```

```bash
pnpm add -D @j4k-oss/pr-feedback
```

All of these provide the same `pr-feedback` command.

## Prerequisites

- Node.js 26.0.0+
- Git installed (`git`), with `user.name` and `user.email` configured, and a repository with an `origin` remote. Both are unnecessary when you pass `--repo` and `--pr`.
- the j4k `fgj` build with `pr review resolve`/`unresolve` (v0.5.0-j4k.4 or newer), authenticated

The j4k Forgejo fork resolves inline review conversations through the local
`fgj` CLI; the [Commands](#commands) table says when each command resolves one. Plain PR
comments have no hide API, so their status remains reaction-backed. Published review bodies are tracked through their native backing comment IDs.
Inline review comments and plain PR comments (Forgejo issue comments) are surfaced and tracked normally.
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
item's reaction is recorded independently, so any item that is not yet agreed
or acknowledged defers the shared conversation's resolution.
Because native resolution belongs to the whole conversation, `start` or a
viewer-owned `disagree` on any finding reopens that shared conversation.
Siblings keep their final reactions, and the conversation resolves
again once every finding is agreed or acknowledged.
`summary --hide-resolved` hides an agreed or acknowledged item as soon as its
own final reaction is recorded, even when an unsettled sibling defers the
native conversation resolution. Every other inline finding remains visible
while its native conversation is open. A conversation resolved by
another user hides all of its findings because `start` and `disagree` preserve
that user's resolution. Plain PR comments have no conversation axis, so their
final reaction still controls that filter.

### Custom Paths

To use a specific binary (or one not in `PATH`), set:

```bash
export PR_FEEDBACK_GIT_PATH=/path/to/git
export PR_FEEDBACK_FGJ_PATH=/path/to/fgj
```

For an origin that is already detected as Forgejo, override the REST API host — useful when the origin uses an SSH alias (e.g. a tailnet host) that differs from the HTTP API host:

```bash
export PR_FEEDBACK_FORGEJO_API_HOST=code.j4k.dev
```

This overrides only the API hostname. `pr-feedback` treats an origin as Forgejo only when `@j4k-oss/repoq` resolves it to the [Forge](https://code.j4k.dev/j4k-oss/pr-feedback/src/branch/main/CONTEXT.md#language), so this variable does not, on its own, enable any other instance.

`@j4k-oss/repoq` classifies every parseable non-GitHub host as a candidate Forgejo instance, so the origin check in `src/lib/provider.ts` rejects any origin whose resolved API host is not the Forge's. Keep that check when upgrading `@j4k-oss/repoq`.

## Usage

Every command acts on one pull request. `--pr <number>` selects it and defaults to the open
PR whose head is the current branch. `--repo <owner/repo>` selects the repository and defaults
to `origin`. `--repo` requires `--pr`, because a branch's PR is looked up only in origin's
repository. With both given, no Git executable or checkout is needed.

```bash
# Read another PR without a checkout
pr-feedback summary --repo owner/repo --pr 12 --json

# Act on another PR of the origin repository
pr-feedback ack 123456 --pr 12

# Get all PR feedback with status
pr-feedback summary

# Get TSV output for scripting
pr-feedback summary --porcelain

# Get full content of a specific item
pr-feedback detail 123456

# Mark item as work-in-progress
pr-feedback start 123456

# Mark as agreed/fixed
pr-feedback agree 123456 -m 'Fixed in commit abc123'

# Same, but read the message from stdin; stdin is read only for -f - or --interactive
printf '%s\n' 'Fixed in commit abc123' | pr-feedback agree 123456 -f -

# Heredoc for messages with special characters (backticks, $, {})
pr-feedback disagree 123456 -f - <<'EOF'
In destructuring, `const { foo: foo } = obj` is equivalent to `const { foo } = obj`.
Updated transform and added test coverage.
EOF

# Mark as disagreed/won't fix
pr-feedback disagree 123456 -m 'Intentional, see docs'

# Request clarification
pr-feedback ask 123456 -m 'Could you clarify the expected behavior?'

# Acknowledge noise
pr-feedback ack 123456

# Reply without changing status (no reaction or resolution change); prints the reply URL
pr-feedback reply 123456 -m 'Tracked in https://code.j4k.dev/owner/repo/pulls/12'

# Preview any action without executing
pr-feedback agree 123456 -m 'Fixed' --dry-run
```

## Commands

| Command                                    | Description                                                                                                                               |
| ------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `summary`                                  | Get all PR feedback with semantic status                                                                                                  |
| [`snapshot`](#complete-feedback-snapshots) | Read a complete, versioned feedback snapshot                                                                                              |
| `detail <id>`                              | Fetch full untruncated content                                                                                                            |
| `start <id>`                               | Mark as work-in-progress (adds eyes reaction)                                                                                             |
| `agree <id> -m "..."`                      | Fixed (reply + thumbs_up; resolves its inline conversation, if any, once every item in it is agreed or acknowledged)                      |
| `disagree <id> -m "..."`                   | Won't fix (reply + thumbs_down; leaves its inline conversation, if any, for the reviewer to settle, reopening it only if you resolved it) |
| `ask <id> -m "..."`                        | Need clarification (reply + confused)                                                                                                     |
| `ack <id>`                                 | Acknowledge noise (rocket; resolves its inline conversation, if any, once every item in it is agreed or acknowledged)                     |
| `reply <id> -m "..."`                      | Reply only (status, reactions and conversation unchanged)                                                                                 |

### Complete feedback snapshots

`pr-feedback snapshot --repo owner/repo --pr 123` reads all review bodies, inline
comments, issue comments, viewer reactions, and native conversation resolution
metadata twice. It takes the same `--repo` and `--pr` as every command. API host
selection and viewer identity use the existing authenticated Forgejo context, not
command-line overrides.

Stdout is one JSON document identified by `schema: "pr-feedback.snapshot"` and
`version: 1`, with actual `host`, `slug`, `pr`, `viewer`, API `limit`, `stable`,
`diagnostics`, `pull`, `reviews`, `issueComments`, `conversations`, and
`unpublishedInlineComments`. Exit 0 means two complete equal passes; exit 3
emits a valid but unstable document that must not be treated as settlement.
Fetch or schema failures exit nonzero without a snapshot. Requests and token
acquisition have a 15-second timeout; progress and errors use stderr.

Published review bodies use the native backing comment ID from their PR-scoped
`html_url`; the review entity ID is provenance, not an action target. Bodies with
no backing anchor and unpublished records remain visible in snapshots but cannot
be acted on.

Inline findings remain independent even when they share a native conversation;
only authenticated reply markers attach responses.

Replies retain the persisted `<!-- gh-feedback:reply-to:ID -->` marker so existing PR replies continue to attach to their original feedback items. The marker is a stored-data contract, not a command or package alias.

### Summary Output

The `summary` command outputs all PR feedback with semantic status. Status combines your reactions with resolution state:

| Status           | Meaning                                                                                                                |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `pending`        | Needs attention (no reaction, not done)                                                                                |
| `in-progress`    | Work started, or reactions and resolution disagree (e.g. conflicting final reactions, resolved with no final reaction) |
| `awaiting-reply` | Asked a question (😕), not resolved; a reply does not clear it                                                         |
| `agreed`         | Fixed (👍; the conversation may stay open, see [Prerequisites](#prerequisites))                                        |
| `disagreed`      | Won't fix (👎; `disagree` never resolves the conversation)                                                             |
| `acknowledged`   | Noted, no action (🚀; the conversation may stay open)                                                                  |

`summary` projects the [complete feedback snapshot](#complete-feedback-snapshots), including review
bodies; a missing-anchor body has `id: null`, `actionable: false`, and `reviewId`
provenance in JSON. Pretty output labels these bodies as nonactionable reviews;
TSV retains them with an empty ID field and their pending status. An empty ID cannot
be passed to mutation commands; filter it out when extracting actionable IDs.

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
pr-feedback summary | awk -F'\t' '$3 == "pending"'

# Filter to items awaiting reply
pr-feedback summary | awk -F'\t' '$3 == "awaiting-reply"'

# Sort by timestamp (oldest first)
pr-feedback summary | tail -n +2 | sort -t$'\t' -k2

# Count items by status
pr-feedback summary | tail -n +2 | cut -f3 | sort | uniq -c

# Get just IDs of pending items
pr-feedback summary | awk -F'\t' '$3 == "pending" && $1 != "" {print $1}'

# Filter items in a specific file
pr-feedback summary | awk -F'\t' '$5 ~ /src\/auth/'

# JSON output with jq (redirect stderr to suppress progress message)
pr-feedback summary --json 2>/dev/null | jq '.items[0]'
```

## Agent Rule

Add to your `CLAUDE.md` or `AGENTS.md`:

```markdown
# Rule: pr-feedback CLI Usage

`pr-feedback` is a globally available CLI. Prefer it over raw `fgj` commands for PR feedback operations: reading a PR's feedback, and replying to and settling each item. Every command operates on the current branch's PR unless you pass `--pr <number>` (and `--repo <owner/repo>` outside origin's repository).

Before first use in a session, run `pr-feedback --help` and subcommand help (e.g., `pr-feedback agree --help`) to learn available commands and options.
```

## Slash Command

A ready-made slash command is available in the repository at [`slash-command/process-feedback.md`](https://code.j4k.dev/j4k-oss/pr-feedback/src/branch/main/slash-command/process-feedback.md). The prompt works with Claude Code, Cursor, and other agents that support markdown-based commands.

To install for Claude Code, download the file to your project's `.claude/commands/` directory. Then invoke with `/process-feedback`. The command systematically processes all PR feedback items: fixing issues, disagreeing with evidence, acknowledging bot noise, or requesting clarification.

## License

MIT

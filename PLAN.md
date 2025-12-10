# gh-feedback Workflow Enhancement Plan

## Goal

Simplify `gh-feedback` to better support LLM-driven PR review workflows by:

1. Adding semantic commands that map to workflow actions
2. Creating a unified `summary` command optimized for LLM context gathering
3. Removing the need for LLMs to understand entity types (thread/comment/review)

## Phase 1: Unified Semantic Commands

Add top-level commands that auto-detect entity type and perform complete workflow actions.

### Commands

| Command                  | Intent               | Actions                     |
| ------------------------ | -------------------- | --------------------------- |
| `summary`                | "Get context"        | list all items (TSV/pretty) |
| `detail <id>`            | "Full content"       | fetch untruncated item      |
| `start <id>`             | "Working on it"      | adds 👀 reaction            |
| `agree <id> -m "..."`    | "Fixed"              | reply + 👍 + resolve        |
| `disagree <id> -m "..."` | "Won't fix"          | reply + 👎 + resolve        |
| `ask <id> -m "..."`      | "Need clarification" | reply + 😕 + keep open      |
| `ack <id>`               | "Noted, no action"   | 🚀 + hide                   |

### Entity Type Detection

Reuse existing `fetchItemDetail` pattern that tries: thread → comment → review.

Each command routes to the appropriate subcommand handler based on detected type:

- Threads: can be resolved natively
- Comments/Reviews: "resolve" means hide

### Message Input

Support same patterns as existing commands:

- `-m "message"` flag
- `--file path` flag
- stdin (piped input)

## Phase 2: Summary Command Rewrite

### Output Modes

**Non-interactive (TSV)** - when stdout is not a TTY or `--porcelain` flag:

- Tab-separated values
- One line per item
- Header row included
- Newlines in content escaped as `\n`
- Easy to pipe to `cut`, `awk`, `sort`

**Interactive (pretty)** - when stdout is a TTY:

- Human-readable formatting
- Multi-line bodies
- Visual grouping

### TSV Column Order

```
ID	TIMESTAMP	STATUS	AUTHOR	LOCATION	BODY	RESPONSES
```

### Status Values

Derived from viewer's reactions (semantic mapping):

| Reaction       | Status           |
| -------------- | ---------------- |
| 👀 eyes        | `in-progress`    |
| 😕 confused    | `awaiting-reply` |
| 👍 thumbs_up   | `agreed`         |
| 👎 thumbs_down | `disagreed`      |
| 🚀 rocket      | `acknowledged`   |
| (none)         | `pending`        |

### Resolution Logic

An item is considered "done" if:

- Thread is resolved, OR
- Comment/Review is hidden

Both states mean "handled" - the implementation detail is hidden from the user.

### Responses Format

All replies concatenated in single RESPONSES cell:

```
@alice 2024-01-15T10:30:00Z: First reply|@bob 2024-01-15T11:00:00Z: Second reply
```

### Content Truncation

- Threshold: 500 characters
- Truncate in the middle with `[...]` marker
- Preserve start and end for context

### Example TSV Output

```
ID	TIMESTAMP	STATUS	AUTHOR	LOCATION	BODY	RESPONSES
456	2024-01-15T10:30:00Z	pending	alice	src/foo.ts:42	This should use const
789	2024-01-15T11:00:00Z	in-progress	bob		Can you add tests?	@you 2024-01-15T12:00:00Z: Looking into this
111	2024-01-15T09:00:00Z	agreed	charlie	src/bar.ts:10	Add error handling	@you 2024-01-15T10:00:00Z: Fixed in abc123
```

### Example Interactive Output

```
PR #123: Title
https://github.com/...

PENDING (2)

#456  2024-01-15T10:30:00Z  pending  @alice  src/foo.ts:42
  This should use const

#789  2024-01-15T11:00:00Z  in-progress  @bob
  Can you add tests?
  > @you 2024-01-15T12:00:00Z: Looking into this

DONE (1)

#111  2024-01-15T09:00:00Z  agreed  @charlie  src/bar.ts:10
  Add error handling
  > @you 2024-01-15T10:00:00Z: Fixed in abc123
```

## Implementation Tasks

### Phase 1: Shared Infrastructure

- [x] Create `src/lib/detect-item-type.ts` - auto-detect thread/comment/review
- [x] Create `src/lib/resolve-item.ts` - resolve threads, hide comments/reviews
- [x] Create `src/lib/react-item.ts` - add/remove reactions to any item
- [x] Create `src/lib/reply-item.ts` - reply to any item

### Phase 2: Semantic Commands

- [x] Create `src/commands/start.ts` - adds 👀 reaction
- [x] Create `src/commands/agree.ts` - reply + 👍 + resolve
- [x] Create `src/commands/disagree.ts` - reply + 👎 + resolve
- [x] Create `src/commands/ask.ts` - reply + 😕 + keep open
- [x] Create `src/commands/ack.ts` - 🚀 + hide
- [x] Create `src/commands/detail.ts` - fetch full content of single item

### Phase 3: Summary Rewrite

- [x] Update GraphQL queries to include `reactionGroups` with `viewerHasReacted`
- [x] Update GraphQL queries to include replies/responses
- [x] Create unified feedback item type with status derived from reactions
- [x] Implement 500 char truncation with middle ellipsis
- [x] Create TSV formatter (escaped newlines, tab-separated)
- [x] Create pretty formatter (human-readable, multi-line)
- [x] Add TTY detection for auto-selecting format
- [x] Add `--porcelain` flag to force TSV output
- [x] Update `summary` command with new implementation

### Phase 4: Cleanup

- [x] Remove `src/commands/thread.ts` and related files
- [x] Remove `src/commands/comment.ts` and related files
- [x] Remove `src/commands/review.ts` and related files
- [x] Remove `status` command from `src/cli.ts`
- [x] Remove old `read` command (replaced by `detail`)
- [x] Update `src/cli.ts` to register only new commands
- [x] Update help text with workflow examples
- [x] Remove unused types, queries, and utilities

### Phase 5: Testing & Documentation

- [ ] Test all commands with real PR
- [ ] Verify TSV output works with Unix pipelines
- [ ] Verify pretty output in interactive terminal
- [ ] Update README with new command reference
- [ ] Remove PLAN.md after implementation complete

### Breaking Changes

Remove old entity-specific subcommands:

- Remove `thread` subcommand (reply, react, unreact, resolve, hide, show)
- Remove `comment` subcommand (reply, react, unreact, hide, show)
- Remove `review` subcommand (react, unreact, hide, show)
- Remove `status` command (replaced by `summary`)
- Rename `read` command to `detail`

The CLI exposes only semantic workflow commands:

```
gh-feedback summary                # Get context (all items)
gh-feedback detail <id>            # Full content (single item)
gh-feedback start <id>             # Mark as working
gh-feedback agree <id> -m "..."    # Fixed
gh-feedback disagree <id> -m "..."   # Won't fix
gh-feedback ask <id> -m "..."      # Need clarification
gh-feedback ack <id>               # Acknowledge noise
```

## Example Workflow

```bash
# 1. Get context
gh-feedback summary

# 2. Start working on item
gh-feedback start 456

# 3. Fix the code, push changes

# 4. Mark as done
gh-feedback agree 456 -m "Fixed in abc123"

# Or if disagreeing:
gh-feedback disagree 456 -m "Intentional - see RFC-123"

# Or if need clarification:
gh-feedback ask 456 -m "Could you clarify the expected behavior?"

# Or if just noise:
gh-feedback ack 456
```

## Unix Pipeline Examples

TSV output enables standard Unix tooling:

```bash
# Filter to only pending items
gh-feedback summary | awk -F'\t' '$3 == "pending"'

# Filter to items awaiting reply
gh-feedback summary | awk -F'\t' '$3 == "awaiting-reply"'

# Sort by timestamp (oldest first)
gh-feedback summary | tail -n +2 | sort -t$'\t' -k2

# Sort by status
gh-feedback summary | tail -n +2 | sort -t$'\t' -k3

# Count items by status
gh-feedback summary | tail -n +2 | cut -f3 | sort | uniq -c

# Get just IDs of pending items
gh-feedback summary | awk -F'\t' '$3 == "pending" {print $1}'

# Pretty print with column alignment
gh-feedback summary | column -t -s$'\t'

# Filter items in a specific file
gh-feedback summary | awk -F'\t' '$5 ~ /src\/auth/'
```

---
description: Process PR feedback systematically - fix issues, reject with evidence, or request clarification
argument-hint: optional focus area or specific instructions
---

# Goal

Process every review comment on the current PR using the `gh-feedback` CLI so nothing is dropped or left ambiguous: each item ends fixed (and agreed), disagreed with evidence, acknowledged as noise, or waiting for reviewer clarification.

# Inputs

User-provided free-form instruction (may be empty): `$ARGUMENTS`

**This input takes absolute precedence over all defaults, heuristics, rules, and suggestions that follow.**

# Reference

## Status meanings

| Status           | Meaning                           | Action                           |
| :--------------- | :-------------------------------- | :------------------------------- |
| `pending`        | New item, needs attention         | Process it                       |
| `in-progress`    | Being worked on or interrupted    | Continue, re-evaluate, or finish |
| `awaiting-reply` | Blocked on reviewer clarification | Check for new replies            |
| `agreed`         | Fixed and done                    | None                             |
| `disagreed`      | Won't fix (with explanation)      | None                             |
| `acknowledged`   | Bot noise, noted                  | None                             |

## Resolution commands

| Scenario               | Command                                                            |
| :--------------------- | :----------------------------------------------------------------- |
| **Valid issue**        | Fix code, push, then: `gh-feedback agree <id> -m "Fixed in <sha>"` |
| **Already fixed**      | `gh-feedback agree <id> -m "Already fixed in <sha>"`               |
| **Disagree**           | `gh-feedback disagree <id> -m "<evidence/reasoning>"`              |
| **Need clarification** | `gh-feedback ask <id> -m "<your question>"`                        |
| **Bot noise/summary**  | `gh-feedback ack <id>`                                             |
| **Duplicate**          | Same action and reply as original item                             |

## Workflow rules

- To re-resolve a done item (`agreed`/`disagreed`/`acknowledged`), first run `gh-feedback start <id>` to reopen it
- Never `agree` until the fix is pushed—the commit SHA proves the work is done
- When using `disagree`, cite evidence: command output, doc links, or test results

# Task

## 1. Preflight (fail fast)

1. Confirm the tool is runnable:
   - Run `gh-feedback --help`.
   - If it fails or the command is not found, stop and report the error output.

2. Capture PR feedback state (this also validates GitHub auth/permissions):
   - Run `gh-feedback summary`.
   - If the command errors (for example, unauthorized or missing permissions), stop and report the error output.
   - **No PR for current branch:** Stop and tell the user there is no PR associated with the current branch.
   - **No actionable items:** If there are no `pending`, `in-progress`, or `awaiting-reply` items, report that feedback processing is complete.

## 2. Interpret the user-provided instructions

- If the user provided no instructions, process all actionable items end-to-end.
- If the user-provided instructions limit scope (e.g., “only handle awaiting-reply” or “only items 12 and 17”), follow that scope.
- If the user-provided instructions suggest a focus area (e.g., “performance concerns”), use it as a lens for decisions and explanations, but still process all actionable items unless the instructions explicitly restrict scope.

## 3. Process items

Work through items in this priority order:

### Priority 1: `in-progress` items

These may be active work, interrupted from a previous session, or resolved incorrectly outside this workflow.

- **Active bot processes** (messages like "is working…", "analyzing…"): Skip—leave for next run.
- **Interrupted work**: Resume analysis and resolution.
- **Already resolved outside workflow**: Re-evaluate and apply the appropriate resolution.

### Priority 2: `awaiting-reply` items

Check if the reviewer has responded since the question was asked:

- **New reply found**: Run `gh-feedback start <id>` to reopen, then process based on the new information.
- **No reply yet**: Leave as `awaiting-reply` and move on.

### Priority 3: `pending` items

Standard processing—these are new and need full attention.

## 4. For each item to process

### Start work

Run `gh-feedback start <id>` to mark the item as `in-progress`.

### Analyze

1. **Check for truncation:** If the body shows `[TRUNCATED]`, run `gh-feedback detail <id>` to fetch full content.

2. **Verify claims—don't accept blindly:**
   - Check if the code still exists or was already fixed
   - For most claims write a minimal test script to verify and reproduce directly if possible
   - Consult official documentation for factual accuracy

### Resolve

Apply one of the resolution commands from the Reference section based on your analysis.

For fixes: push the changes first, then run the `agree` command with the commit SHA in the reply.

## 5. Verify completion

Run `gh-feedback summary` and confirm:

- No `pending` items remain
- No `in-progress` items remain (except active bot processes)
- All items are `agreed`, `disagreed`, `acknowledged`, or `awaiting-reply`

# Output

Brief summary of actions taken: items processed (by id), fixes made (with commit SHA), disagreements (with evidence), and any items left awaiting clarification.

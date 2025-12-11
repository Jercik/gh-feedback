---
description: Process PR feedback systematically - fix issues, reject with evidence, or request clarification
argument-hint: optional focus area or specific instructions
---

# Goal

Process every review comment on the current PR using `gh-feedback` CLI so nothing is dropped or left ambiguous: each item ends fixed, rejected with evidence, acknowledged, or waiting for clarification.

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

| Scenario               | Command                                              |
| :--------------------- | :--------------------------------------------------- |
| **Valid issue**        | Fix code, push, then: `agree <id> -m "Fixed in SHA"` |
| **Already fixed**      | `agree <id> -m "Already fixed in SHA"`               |
| **Disagree**           | `disagree <id> -m "<evidence/reasoning>"`            |
| **Need clarification** | `ask <id> -m "<your question>"`                      |
| **Bot noise/summary**  | `ack <id>`                                           |
| **Duplicate**          | Same action and reply as original item               |

## Workflow rules

- To re-resolve a done item (`agreed`/`disagreed`/`acknowledged`), first run `start <id>` to reopen it
- Never `agree` until the fix is pushed—the commit SHA proves the work is done
- When using `disagree`, cite evidence: command output, doc links, or test results

# Task

## 1. Learn the tool

At the start of the session, run `gh-feedback --help` to understand available commands and options.

## 2. Get context

Run `gh-feedback summary` to see all feedback items with their current status.

- **No PR for current branch:** Stop and inform the user.
- **No actionable items:** If no `pending`, `in-progress`, or `awaiting-reply` items remain, report that feedback processing is complete.

## 3. Process items

Work through items in this priority order:

### Priority 1: `in-progress` items

These may be active work, interrupted from a previous session, or resolved incorrectly outside this workflow.

- **Active bot processes** (messages like "is working…", "analyzing…"): Skip—leave for next run.
- **Interrupted work**: Resume analysis and resolution.
- **Already resolved outside workflow**: Re-evaluate and apply the appropriate resolution.

### Priority 2: `awaiting-reply` items

Check if the reviewer has responded since the question was asked:

- **New reply found**: Run `start <id>` to reopen, then process based on the new information.
- **No reply yet**: Leave as `awaiting-reply` and move on.

### Priority 3: `pending` items

Standard processing—these are new and need full attention.

## 4. For each item to process

### Start work

Run `gh-feedback start <id>` to mark the item as `in-progress`.

### Analyze

1. **Check for truncation:** If the bodyi shows `[TRUNCATED]`, run `gh-feedback detail <id>` to fetch full content.

2. **Verify claims—don't accept blindly:**
   - Check if the code still exists or was already fixed
   - For most claims write a minimal test script to verify and reporoduce directly if possible
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

Summary of actions taken: items processed, fixes made, disagreements explained, and any items left awaiting clarification.

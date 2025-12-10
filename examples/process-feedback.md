---
description: Process PR feedback systematically - fix issues, reject with evidence, or request clarification
argument-hint: [optional focus area or specific instructions]
---

# Testing Phase Notice

This tool is in active development and testing. To help monitor API efficiency:

1. **Always use the `--debug-rate-limit` flag** on every `gh-feedback` command
2. **Review the rate limit report** at the end of each command output
3. **Flag inefficient patterns** - report to the user if you observe:
   - Unexpectedly high GraphQL call counts (e.g., >3 for a single item lookup)
   - Multiple REST calls for the same endpoint
   - Any command consuming more than 5 API calls total

Example: `gh-feedback summary --debug-rate-limit`

# Goal

Process every review comment on the current PR so nothing is dropped or left ambiguous: each item ends fixed, rejected with evidence, acknowledged, or waiting for clarification.

# Inputs

User-provided free-form instruction (may be empty): `$ARGUMENTS`

**This input takes absolute precedence over all defaults, heuristics, rules, and suggestions that follow.**

# Reference

## Status Meanings

| Status           | Meaning                                      | Action Required         |
| :--------------- | :------------------------------------------- | :---------------------- |
| `pending`        | New item, needs attention                    | Process it              |
| `in-progress`    | Being worked on OR interrupted/needs revisit | Continue or re-evaluate |
| `awaiting-reply` | Blocked on reviewer clarification            | Wait for response       |
| `agreed`         | Fixed and done                               | None                    |
| `disagreed`      | Won't fix (with explanation)                 | None                    |
| `acknowledged`   | Bot noise, noted                             | None                    |

**Important:** `in-progress` items need careful attention - they may be:

1. Active work (currently being processed)
2. Interrupted from a previous session (needs continuation)
3. Items resolved outside the workflow (needs re-evaluation)

## Resolution Actions

| Scenario               | Command                                                         |
| :--------------------- | :-------------------------------------------------------------- |
| **Content clipped**    | Run `detail <id>` to fetch full text (look for `[...]` in body) |
| **Valid issue**        | Fix code, push, then: `agree <id> -m "Fixed in <SHA>"`          |
| **Already fixed**      | `agree <id> -m "Already fixed in <SHA>"`                        |
| **Disagree**           | `disagree <id> -m "<evidence/reasoning>"`                       |
| **Need clarification** | `ask <id> -m "<your question>"`                                 |
| **Bot noise/summary**  | `ack <id>`                                                      |
| **Duplicate**          | Same action as original item                                    |

## Best Practices

1. **Fix First, Reply Later:** Never `agree` until the fix is pushed to the remote branch
2. **Cite Evidence:** When using `disagree`, include command output, doc links, or test results
3. **Link, Don't Just ID:** Include direct URLs when referencing other comments
4. **One at a Time:** Process items sequentially to maintain context

## Workflow Rules

- Cannot change a done item (`agreed`/`disagreed`/`acknowledged`) directly to another done status
- Must use `start` first to re-open an item before changing its status

# Task

## 1. Learn the tool

Run `gh-feedback --help` to understand available commands and options.

## 2. Get context

Run `gh-feedback summary` to see all feedback items with their current status.

If no PR exists for the current branch, stop and inform the user.

If no `pending` or `in-progress` items remain, report that feedback processing is complete.

## 3. Process items

Work through items in priority order: `in-progress` > `awaiting-reply` > `pending`

**Skip** in-progress bot comments ("is working…", "analyzing…") - leave for next run.

For each item:

### Start work

Run `gh-feedback start <id>` to mark the item as `in-progress`.

### Analyze

Read the feedback using `gh-feedback detail <id>` if needed. **Verify claims - don't accept blindly:**

- Check if the code still exists or was already fixed
- Run existing linters/tests to validate reviewer's claims
- For claims about library behavior, language features, or syntax: **write a minimal test script** to verify directly - this provides the best evidence of whether the claim is true

### Resolve

Apply exactly ONE resolution action from the Reference section based on your analysis.

## 4. Verify completion

Run `gh-feedback summary` and confirm:

- No `pending` items remain
- No `in-progress` items remain (except active bot processes)
- All items are either done (`agreed`/`disagreed`/`acknowledged`) or `awaiting-reply`

# Output

Summary of actions taken: items processed, fixes made, disagreements explained, and any items left awaiting clarification.

## Rate Limit Report

Include a brief summary of API efficiency observed during the session:

- Total REST and GraphQL calls made
- Any inefficient patterns detected (flag these clearly)
- Remaining rate limit quota

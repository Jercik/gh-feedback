---
description: Process PR feedback systematically - fix issues, disagree with evidence, or request clarification
argument-hint: optional focus area or specific instructions
---

# Goal

Process every review comment on the current PR using `gh-feedback` CLI so nothing is dropped or left ambiguous: each item ends fixed, disagreed with evidence, acknowledged, or waiting for clarification.

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

## Review types

Feedback comes from two distinct review workflows with different handling:

### Code reviews ("_Code review by..._")

Code reviews focus on implementation details: correctness, error handling, performance, and code quality. Process these using your best judgment—fix valid issues, disagree with evidence when incorrect, or acknowledge bot noise.

### Approach reviews ("_Approach review by..._")

Approach reviews are usually high-level reviews questioning whether the PR uses the best solution to the problem. Unlike code reviews (which are mostly objectively correct or not), approach alternatives are judgment calls. **These should be taken seriously and they require user decision:**

- If the review says "approach looks good" with no suggestions → `gh-feedback ack` (positive confirmation, no action needed)
- If the review proposes an alternative approach:
  1. Summarize the suggestion to the user
  2. Ask: "The approach review suggests [X]. Should we implement this change?"
  3. Wait for user decision before proceeding
  4. Based on user response: implement the change, or `disagree` with explanation

## Resolution commands

| Scenario               | Command                                                          |
| :--------------------- | :--------------------------------------------------------------- |
| **Valid issue**        | Fix code, push, then: `gh-feedback agree <id> -m "Fixed in SHA"` |
| **Already fixed**      | `gh-feedback agree <id> -m "Already fixed in SHA"`               |
| **Disagree**           | See "Disagreement with proactive improvement" below              |
| **Need clarification** | `gh-feedback ask <id> -m "<your question>"`                      |
| **Bot noise/summary**  | `gh-feedback ack <id>`                                           |
| **Duplicate**          | Same action and reply as original item                           |
| **Out of scope**       | See "Scope decisions" below                                      |

## Disagreement with proactive improvement

When you disagree with a reviewer's assessment, their confusion signals that the code or documentation could be clearer—even if the review is technically incorrect. Before marking an item as `disagreed`, consider whether a small improvement would prevent future confusion:

### Improvement options (in order of preference)

1. **Clarifying code comment**: Add a brief comment explaining why the code works the way it does, especially for non-obvious logic, intentional trade-offs, or edge cases that look like bugs but aren't.

2. **Better naming**: Rename variables, functions, or types to make the intent self-evident.

3. **Documentation update**: Update README, inline docs, or JSDoc to explain the design decision or behavior.

4. **Code restructure**: If the confusion stems from convoluted logic, simplify or reorganize the code.

### When NOT to add clarification

- The reviewer misread or misunderstood something that's already clear
- Adding a comment would be more confusing than helpful
- The "clarification" would just be restating the obvious

### Disagreement command format

After making any improvements, run:

```
gh-feedback disagree <id> -m "<explanation>. Added clarification in <location> to prevent future confusion."
```

Or if no improvement was warranted:

```
gh-feedback disagree <id> -m "<evidence/reasoning>"
```

## Scope decisions

The goal is to produce the best possible version of this PR. If a suggestion would improve the code, implement it now—don't defer.

**Default behavior: implement it.** When you agree a change would make the code better, just do it. This includes:

- Nitpicks and style improvements
- Better naming, clearer code structure
- Bug fixes or edge cases the reviewer spotted
- Documentation improvements
- Any change that makes the PR objectively better

"I'll do this in the next PR" is almost always wrong. That hypothetical future PR rarely happens, and even when it does, the context is lost. The reviewer took time to point something out—if they're right, act on it now while everything is fresh.

### Common invalid "out of scope" reasoning

These are NOT valid reasons to defer:

- **"The file isn't in the current diff"** — If the PR changes behavior that docs or CLI describe, update them. A complete feature includes its documentation.

- **"This PR focuses on [X]"** — Don't invent scope constraints. Unless the user explicitly said "only touch the API layer" or similar, assume all related changes belong together.

- **"It's a different subsystem"** — README, CLI, tests, and types that reference changed behavior are part of the same change, not separate work.

### Valid reasons to defer (rare)

- Adding an entirely new feature unrelated to the current change
- Refactoring that would triple the PR size without addressing the core issue
- Changes requiring separate review expertise (e.g., security-sensitive changes)

When uncertain, ask: "Would a thorough developer include this in the same PR?" If yes, implement it. For the rare genuinely out-of-scope item, use `disagree` with an explanation of why it belongs in a separate PR.

## Workflow rules

- To re-resolve a done item (`agreed`/`disagreed`/`acknowledged`), first run `gh-feedback start <id>` to reopen it
- Never mark an item `agreed` until the fix is pushed—the commit SHA proves the work is done
- When marking an item `disagreed`, cite evidence: command output, doc links, or test results

## Reviewer context limitations

Approach reviewer feedback with healthy skepticism. Reviewers often lack critical context about your project's architecture, constraints, design decisions, and history. This context asymmetry means well-intentioned feedback may be:

- Based on incorrect assumptions about how the project works
- Applying patterns that don't fit your specific situation
- Citing external library/tool behavior that's outdated or misremembered
- Suggesting "best practices" that conflict with your actual requirements

**Don't accept feedback at face value.** When a reviewer makes a claim—especially about external projects, libraries, or tools—verify it independently before acting. Your deeper project knowledge means you're better positioned to judge whether feedback applies to your situation.

**Claims about external projects require source verification.** Documentation can be outdated, blog posts can be wrong, and reviewers can misremember. The source code is the ultimate source of truth. When a reviewer claims "library X does Y" or "tool Z works this way," verify by examining the actual codebase.

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

- **New reply found**: Run `gh-feedback start <id>` to reopen, then process based on the new information.
- **No reply yet**: Leave as `awaiting-reply` and move on.

### Priority 3: `pending` items

Standard processing—these are new and need full attention.

## 4. For each item to process

### Start work

Run `gh-feedback start <id>` to mark the item as `in-progress`.

### Analyze

1. **Check for truncation:** If the body shows `[TRUNCATED]`, run `gh-feedback detail <id>` to fetch full content.

2. **Verify claims with extreme skepticism:**

   Remember: reviewers lack your project context and are frequently wrong. Treat every claim as unverified until you confirm it yourself.

   **For claims about your codebase:**
   - Check if the code still exists or was already fixed
   - For most claims write a minimal test script to verify and reproduce directly if possible

   **For claims about external projects, libraries, or tools:**

   When a reviewer claims something about an external project's behavior, API, or implementation, verify by examining the actual source code—not just documentation or your memory.

   Use parallel subagents to check out and explore the relevant repository:
   1. **Identify the repository:** Determine the GitHub repository for the external project (e.g., `facebook/react`, `vercel/next.js`)

   2. **Clone to a temporary directory:** Spawn a subagent to clone the repository to a unique temp directory:

      ```
      TMP_DIR="$(mktemp -d)" && git clone https://github.com/<owner>/<repo>.git "$TMP_DIR"
      ```

      Use `--depth 1` for faster cloning when you only need the latest default branch state. Omit it when you need to check out specific tags or releases.

   3. **Explore the codebase:** Have the subagent search for and read the relevant source files to confirm or refute the reviewer's claim. Look for:
      - The specific function, class, or module the reviewer referenced
      - The actual implementation behavior, not just type signatures
      - Version-specific behavior if relevant (check out the relevant tag first)

   4. **Document findings:** The subagent should report what it found with specific file paths and line numbers from the source code

   Run multiple subagents in parallel when verifying claims about different projects to minimize wait time.

   **Evaluation after verification:**
   - If the source code confirms the reviewer's claim: consider their feedback valid
   - If the source code contradicts their claim: disagree with evidence citing the actual implementation
   - If the behavior is ambiguous or version-dependent: note this nuance in your response

### Resolve

Apply one of the resolution commands from the Reference section based on your analysis.

**For fixes:** Push the changes first, then run the `agree` command with the commit SHA in the reply.

**For disagreements:** Before disagreeing, ask yourself: "Why did the reviewer think this was a problem?" If there's any ambiguity in the code or docs that could cause future confusion:

1. Make a clarifying improvement (comment, rename, doc update, or restructure)
2. Push the improvement
3. Run `disagree` with an explanation that references the clarification

This turns disagreements into opportunities to improve the codebase.

## 5. Update PR metadata if needed

After processing feedback items, check whether the changes you made affect what the PR title or description say:

**Review the PR metadata:**

Run `gh pr view --json title,body` to see the current title and description.

**Update when changes alter described behavior:**

- **Title:** Update if the PR's scope, primary purpose, or affected component changed significantly (e.g., "fix validation bug" became "refactor validation system")
- **Description:** Update if code changes invalidate or modify what the description says—changed behavior, different implementation approach, new edge cases handled, renamed functions/files mentioned in the description, or added/removed functionality

**Keep metadata accurate:**

Use `gh pr edit --title "new title"` and/or `gh pr edit --body-file - <<'EOF' ... EOF` to update. Preserve the existing structure and update only the parts that changed.

**Skip when changes don't affect accuracy:**

No update needed for internal refactors, bug fixes, or improvements that don't change what the PR description already says.

## 6. Verify completion

Run `gh-feedback summary` and confirm:

- No `pending` items remain
- No `in-progress` items remain (except active bot processes)
- All items are `agreed`, `disagreed`, `acknowledged`, or `awaiting-reply`

## 7. Handle continuous review stream

CI reviews may post new feedback while you're processing existing items—especially after pushing fixes. This is expected behavior. Re-run `gh-feedback summary`; if new `pending` items appear, process them, then repeat step 6 verification until no new items remain.

# Output

Summary of actions taken: items processed, fixes made, disagreements along with any proactive clarifications added, PR metadata updates (if any), and items left awaiting reply.

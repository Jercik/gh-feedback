# Feedback workflow

A CLI for reading and settling pull request feedback on a chosen pull request, by default the current branch's.

## Language

**Finding**:
an actionable plain PR comment (Forgejo issue comment) or inline review comment tracked by viewer reactions. Plain PR comments are separate from native review conversations.

**Conversation**:
the native Forgejo group of inline review comments sharing one resolution and its owner.

**Forge**:
code.j4k.dev; code.tail.j4k.dev is its tailnet origin alias.

**Review service**:
the service that runs the automated review of a PR and answers read requests about it. Each request presents a capability token.

**Summary report**:
the PR comment the review wrapper posts from the Actions identity, starting with `<!-- review:summary -->`.

**Dismissal**:
the permanent rejection of a review-service finding, recorded both on the forge and with the review service.

**Stamp**:
the second line of a summary report, naming the review ID and the head commit the review covers. A report without one, such as a skipped fork PR, has no stamp.

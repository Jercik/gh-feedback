---
status: accepted
---

# Canonical complete feedback snapshot

The CLI owns complete review-body, inline-comment, issue-comment, reaction, and native-resolution reads and emits the versioned `pr-feedback.snapshot` document only after two complete passes; equality means stable and changes mean unstable, never settlement. Review bodies use their PR-scoped native backing comment IDs, while PENDING records and missing anchors stay visible but nonactionable; the processing skill validates identity and retains orchestration, receipts, dispatch checks, and partial-write recovery. Native line conversations supply resolution metadata rather than finding identity, and service acknowledgments and reopened notices remain visible because they can carry substantive findings; merging same-line findings and blanket bookkeeping filtering are rejected.

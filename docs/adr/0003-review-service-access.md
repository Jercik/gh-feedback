---
status: accepted
---

# Review service access

The CLI owns every read of the review service for the PR it targets: it finds the PR's summary report, parses its stamp, loads the credentials, and emits the versioned `pr-feedback.review` document, so callers hold no service client, credentials, or report parsing and keep only the verdict. A review-level verb that takes a review ID and leaves finding the summary comment and parsing its stamp to the caller is rejected, because it spreads knowledge of the wrapper's comment format across every caller.

The CLI also owns every write to the review service, such as a finding's disposition, so callers never handle the capability token or the disposition key.

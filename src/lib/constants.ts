/**
 * Constants for GitHub PR feedback operations.
 */

import type { ReactionContent } from "./types.js";

/** Map from CLI reaction format to GraphQL enum */
export const REACTION_TO_GRAPHQL: Record<ReactionContent, string> = {
  "+1": "THUMBS_UP",
  "-1": "THUMBS_DOWN",
  laugh: "LAUGH",
  confused: "CONFUSED",
  heart: "HEART",
  hooray: "HOORAY",
  rocket: "ROCKET",
  eyes: "EYES",
};

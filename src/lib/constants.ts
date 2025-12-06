/**
 * Constants for GitHub PR feedback operations.
 */

import type { Classifier, ReactionContent } from "./types.js";

export const CLASSIFIERS: readonly Classifier[] = [
  "SPAM",
  "ABUSE",
  "OFF_TOPIC",
  "OUTDATED",
  "DUPLICATE",
  "RESOLVED",
];

export const ALLOWED_REACTIONS: readonly ReactionContent[] = [
  "+1",
  "-1",
  "laugh",
  "confused",
  "heart",
  "hooray",
  "rocket",
  "eyes",
];

export const REACTION_ALIASES: Record<string, ReactionContent> = {
  "+1": "+1",
  ":+1:": "+1",
  thumbs_up: "+1",
  thumbsup: "+1",
  like: "+1",
  "thumbs-up": "+1",
  "\u{1F44D}": "+1",
  "-1": "-1",
  ":-1:": "-1",
  thumbs_down: "-1",
  thumbsdown: "-1",
  dislike: "-1",
  "thumbs-down": "-1",
  "\u{1F44E}": "-1",
  laugh: "laugh",
  "\u{1F600}": "laugh",
  "\u{1F604}": "laugh",
  "\u{1F602}": "laugh",
  "\u{1F923}": "laugh",
  lol: "laugh",
  confused: "confused",
  "\u{1F615}": "confused",
  "\u{1F914}": "confused",
  heart: "heart",
  "\u2764\uFE0F": "heart",
  love: "heart",
  hooray: "hooray",
  "\u{1F389}": "hooray",
  celebrate: "hooray",
  rocket: "rocket",
  "\u{1F680}": "rocket",
  ship_it: "rocket",
  shipit: "rocket",
  eyes: "eyes",
  "\u{1F440}": "eyes",
};

export const CLASSIFIER_ALIASES: Record<string, Classifier> = {
  spam: "SPAM",
  abuse: "ABUSE",
  off_topic: "OFF_TOPIC",
  "off-topic": "OFF_TOPIC",
  offtopic: "OFF_TOPIC",
  outdated: "OUTDATED",
  duplicate: "DUPLICATE",
  resolved: "RESOLVED",
};

export const REACTION_ENUM_MAP: Record<string, ReactionContent> = {
  THUMBS_UP: "+1",
  THUMBS_DOWN: "-1",
  LAUGH: "laugh",
  CONFUSED: "confused",
  HEART: "heart",
  HOORAY: "hooray",
  ROCKET: "rocket",
  EYES: "eyes",
};

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

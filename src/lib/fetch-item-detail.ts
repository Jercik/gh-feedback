import type { Reaction, ReviewState } from "./types.js";

interface ReviewDetail {
  type: "review";
  id: number;
  author: string;
  state: ReviewState;
  url: string;
  submittedAt: string;
  body: string;
  reactions: Reaction[];
}

interface ThreadDetail {
  type: "thread";
  id: number;
  path: string | null;
  line: number | null;
  isOutdated: boolean;
  isResolved: boolean;
  comments: {
    id: number;
    author: string;
    body: string;
    createdAt: string;
    reactions: Reaction[];
  }[];
}

interface CommentDetail {
  type: "comment";
  id: number;
  author: string;
  url: string;
  createdAt: string;
  body: string;
  reactions: Reaction[];
}

export type ItemDetail = ReviewDetail | ThreadDetail | CommentDetail;

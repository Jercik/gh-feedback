import type { ItemDetail } from "./fetch-item-detail.js";
import type { Reaction } from "./types.js";
import { fetchReactions, toReactionSummary } from "./forgejo-reactions.js";
import { getForgejoViewer } from "./fgj-auth.js";
import { exitWithMessage } from "./git-helpers.js";
import { sweepComments } from "./feedback-sweep.js";
import { fetchApiLimit } from "./forgejo-review-pages.js";
import { projectItemDetail } from "./project-item-detail.js";

export async function buildItemDetail(
  slug: string,
  prNumber: number,
  itemId: number,
): Promise<ItemDetail> {
  const { comments } = await sweepComments(
    slug,
    prNumber,
    getForgejoViewer(),
    await fetchApiLimit(),
  );
  const content = projectItemDetail(comments, itemId);
  if (content === undefined) {
    return exitWithMessage(`Error: Could not find item #${itemId} in Forgejo PR #${prNumber}.`);
  }
  const reactionsOn = async (commentId: number): Promise<Reaction[]> =>
    toReactionSummary(await fetchReactions(slug, commentId));
  if (content.type === "thread") {
    return {
      ...content,
      comments: await Promise.all(
        content.comments.map(async (comment) => ({
          ...comment,
          reactions: await reactionsOn(comment.id),
        })),
      ),
    };
  }
  return { ...content, reactions: await reactionsOn(content.id) };
}

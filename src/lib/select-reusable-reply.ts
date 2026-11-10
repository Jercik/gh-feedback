export interface OwnReply {
  id: number;
  url: string;
  text: string;
  createdAt: string;
}

function normalized(text: string): string {
  return text.replaceAll("\r\n", "\n").trim();
}

export function selectReusableReply(
  replies: readonly OwnReply[],
  message: string,
  dispositionCreatedAt: string | undefined,
): OwnReply | undefined {
  const cutoff = dispositionCreatedAt === undefined ? undefined : Date.parse(dispositionCreatedAt);
  return replies
    .filter(
      (reply) =>
        normalized(reply.text) === normalized(message) &&
        (cutoff === undefined || Date.parse(reply.createdAt) > cutoff),
    )
    .toSorted((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt) || b.id - a.id)[0];
}

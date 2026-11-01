interface OrderedComment {
  id: number;
  createdAt: string | null | undefined;
}

export function compareForgejoCommentOrder(left: OrderedComment, right: OrderedComment): number {
  const leftTime =
    left.createdAt === null || left.createdAt === undefined
      ? Number.MAX_SAFE_INTEGER
      : Date.parse(left.createdAt);
  const rightTime =
    right.createdAt === null || right.createdAt === undefined
      ? Number.MAX_SAFE_INTEGER
      : Date.parse(right.createdAt);
  const leftOrder = Number.isNaN(leftTime) ? Number.MAX_SAFE_INTEGER : leftTime;
  const rightOrder = Number.isNaN(rightTime) ? Number.MAX_SAFE_INTEGER : rightTime;
  if (leftOrder !== rightOrder) {
    return leftOrder - rightOrder;
  }
  return left.id - right.id;
}

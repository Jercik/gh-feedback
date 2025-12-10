import { ghJson } from "./github-cli.js";
import type { PageInfo, ReactionGroupNode, Reaction } from "./types.js";

type GraphQLVariables = Record<string, string | number>;

/**
 * Execute a paginated GraphQL query and collect all nodes.
 *
 * @param query - GraphQL query string with $cursor variable for pagination
 * @param variables - Base variables (cursor will be added automatically)
 * @param extractPage - Function to extract pageInfo and nodes from the response
 * @returns Array of all nodes across all pages
 */
export function graphqlPaginate<TNode>(
  query: string,
  variables: GraphQLVariables,
  extractPage: (response: unknown) => { pageInfo: PageInfo; nodes: TNode[] },
): TNode[] {
  const allNodes: TNode[] = [];
  // Extract initial cursor from variables (if provided) and filter it out
  // to avoid passing stale cursor on subsequent iterations
  let cursor: string | undefined =
    typeof variables.cursor === "string" ? variables.cursor : undefined;
  const baseVariables = Object.fromEntries(
    Object.entries(variables).filter(([key]) => key !== "cursor"),
  );
  let hasNextPage = true;

  while (hasNextPage) {
    const arguments_: string[] = [
      "api",
      "graphql",
      "-f",
      `query=${query}`,
      ...Object.entries(baseVariables).flatMap(([key, value]) => [
        "-F",
        `${key}=${String(value)}`,
      ]),
    ];

    if (cursor) {
      arguments_.push("-F", `cursor=${cursor}`);
    }

    const response = ghJson<unknown>(...arguments_);
    const { pageInfo, nodes } = extractPage(response);

    allNodes.push(...nodes);

    hasNextPage = Boolean(pageInfo.hasNextPage && pageInfo.endCursor);
    cursor = pageInfo.endCursor ?? undefined;
  }

  return allNodes;
}

/**
 * Execute a single GraphQL query (non-paginated).
 * Generic is intentionally return-only so callers provide the response shape.
 * Lint suppression remains because strict config flags return-only generics.
 */
// eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters
export function graphqlQuery<T>(query: string, variables: GraphQLVariables): T {
  const arguments_: string[] = [
    "api",
    "graphql",
    "-f",
    `query=${query}`,
    ...Object.entries(variables).flatMap(([key, value]) => [
      "-F",
      `${key}=${String(value)}`,
    ]),
  ];

  return ghJson<T>(...arguments_);
}

/**
 * Transform GraphQL ReactionGroupNode array to simplified Reaction array.
 */
export function mapReactions(reactionGroups: ReactionGroupNode[]): Reaction[] {
  return reactionGroups
    .filter((group) => group.users.totalCount > 0 || group.viewerHasReacted)
    .map((group) => ({
      content: group.content,
      count: group.users.totalCount,
      viewerHasReacted: group.viewerHasReacted,
      users: group.users.nodes.map((user) => user.login),
    }));
}

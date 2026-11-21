export function formatCommentLocation(path: string, line: number | null): string {
  return path === "" || line === null ? path : `${path}:${line}`;
}

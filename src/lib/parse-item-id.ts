import { exitWithMessage } from "./git-helpers.js";

export function parseItemId(value: string): number {
  const id = Math.trunc(Number(value));
  if (Number.isNaN(id) || id <= 0) {
    exitWithMessage(`Error: Invalid ID "${value}".`);
  }
  return id;
}

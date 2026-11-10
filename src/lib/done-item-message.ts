import type { DoneStatus } from "./feedback-types.js";

export function doneItemMessage(itemId: number, doneStatus: DoneStatus): string {
  const hint =
    doneStatus === "dismissed"
      ? "Use 'reopen' to reconsider the dismissal before changing status."
      : "Use 'start' first to re-open it before changing status.";
  return `Error: Item #${itemId} is already "${doneStatus}". ${hint}`;
}

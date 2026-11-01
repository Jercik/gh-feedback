import type { CapabilityResult } from "./feedback-backend.js";

export function reportCompletionResult(result: CapabilityResult): void {
  if (!result.supported) {
    console.error(`Note: conversation resolution skipped - ${result.reason}`);
  } else if (!result.applied) {
    console.error(`Note: ${result.reason}.`);
  }
}

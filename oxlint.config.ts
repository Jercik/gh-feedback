import { defineConfig } from "oxlint";
import { node, nodeTest, vitest } from "@j4k/oxlint-config";

export default defineConfig({
  extends: [node, vitest, nodeTest],
  ignorePatterns: [".claude/", ".clawpatch/", ".codex/"],
});

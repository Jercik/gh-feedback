import { execFileSync } from "node:child_process";
import path from "node:path";

export default function setup(): void {
  const repoRoot = path.resolve(import.meta.dirname, "..");
  // Compile once before workers start so CLI tests never read partially rewritten modules.
  execFileSync(path.join(repoRoot, "node_modules/.bin/tsc"), ["-p", "tsconfig.build.json"], {
    cwd: repoRoot,
    stdio: "inherit",
  });
}

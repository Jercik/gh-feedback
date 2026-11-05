import { execFileSync } from "node:child_process";
import path from "node:path";

export default function setup(): void {
  // Build once before workers start so CLI tests never read partially rewritten modules.
  execFileSync("pnpm", ["run", "build"], {
    cwd: path.resolve(import.meta.dirname, ".."),
    stdio: "inherit",
  });
}

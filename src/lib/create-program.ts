import { Command } from "@commander-js/extra-typings";
import packageJson from "../../package.json" with { type: "json" };
import { verifyPrerequisites } from "./github-environment.js";

/**
 * Create a Commander program with common configuration and preAction hooks.
 * Imports name, version, and description from package.json.
 */
export function createProgram(): Command {
  const program = new Command()
    .name(packageJson.name)
    .description(packageJson.description)
    .version(packageJson.version)
    .showHelpAfterError("(add --help for additional information)")
    .showSuggestionAfterError();

  // Run prerequisite checks before any action
  program.hook("preAction", () => {
    verifyPrerequisites();
  });

  return program;
}

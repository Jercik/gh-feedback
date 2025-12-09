import { Command } from "@commander-js/extra-typings";
import packageJson from "../../package.json" with { type: "json" };
import { verifyPrerequisites } from "./github-environment.js";

/**
 * Create a Commander program with common configuration and preAction hooks.
 *
 * @param name - CLI name
 * @param description - CLI description
 * @returns Configured Command instance
 */
export function createProgram(name: string, description: string): Command {
  const program = new Command()
    .name(name)
    .description(description)
    .version(packageJson.version)
    .showHelpAfterError("(add --help for additional information)")
    .showSuggestionAfterError();

  // Run prerequisite checks before any action
  program.hook("preAction", () => {
    verifyPrerequisites();
  });

  return program;
}

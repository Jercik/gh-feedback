import { Command } from "@commander-js/extra-typings";
import packageJson from "../../package.json" with { type: "json" };
import { enableVerboseMode } from "./verbose-mode.js";
import { GIT_PATH_ENV_VAR } from "./git-helpers.js";
import { FGJ_PATH_ENV_VAR, FORGEJO_API_HOST_ENV_VAR } from "./forgejo-cli.js";

export function createProgram(): Command {
  const program = new Command()
    .name("pr-feedback")
    .description(packageJson.description)
    .version(packageJson.version)
    .showHelpAfterError("(add --help for additional information)")
    .showSuggestionAfterError()
    .helpCommand(false)
    .option("-v, --verbose", "Show progress messages (quiet by default)");
  program.addHelpText(
    "before",
    `Requires: fgj (Forgejo CLI) for code.j4k.dev; git unless both --repo and --pr are given\nOverride paths: ${GIT_PATH_ENV_VAR}, ${FGJ_PATH_ENV_VAR}\nForgejo API host: ${FORGEJO_API_HOST_ENV_VAR}\n\n`,
  );
  program.hook("preAction", (command) => {
    if ((command.opts() as { verbose?: boolean }).verbose) {
      enableVerboseMode();
    }
  });
  return program;
}

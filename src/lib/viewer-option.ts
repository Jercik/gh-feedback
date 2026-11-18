import { InvalidArgumentError, Option } from "@commander-js/extra-typings";
import { ForgejoLogin } from "./forgejo-login.js";

export function viewerOption(): Option<"--viewer <login>", undefined, undefined, ForgejoLogin> {
  return new Option(
    "--viewer <login>",
    "Report the PR as this account settled it (defaults to the fgj auth user login)",
  ).argParser((value) => {
    const login = ForgejoLogin.safeParse(value);
    if (!login.success) {
      throw new InvalidArgumentError("Not a valid Forgejo login.");
    }
    return login.data;
  });
}

export const VIEWER_OPTION_HELP = `
--viewer <login> reads the pull request as that account settled it:
  - the snapshot's viewer field is that login;
  - every item's status counts only the reactions that login added, and the
    replies attached to items are only the ones that login wrote;
  - unpublished drafts are still the token owner's, the only ones Forgejo returns.
It only reads: commands that write do not take it, and act as the token owner.`;

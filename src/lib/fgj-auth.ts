import { forgejoApiHost } from "./forgejo-api-host.js";
import { ForgejoLogin } from "./forgejo-login.js";
import { runFgj } from "./run-fgj.js";

const FGJ_AUTH_USER_MINIMUM_BUILD = "v0.6.1-j4k.4";

function runFgjAuth(subcommand: "token" | "user"): string {
  const result = runFgj(["auth", subcommand, "--hostname", forgejoApiHost()]);
  if (!result.ok) {
    throw new Error(result.message);
  }
  return result.stdout;
}

let cachedToken: string | undefined;

export function fgjToken(): string {
  if (cachedToken) {
    return cachedToken;
  }
  const token = runFgjAuth("token").trim();
  if (!token) {
    throw new Error("Error: fgj auth token returned no token.");
  }
  cachedToken = token;
  return token;
}

let cachedViewer: ForgejoLogin | undefined;

export function getForgejoViewer(): ForgejoLogin {
  if (cachedViewer) {
    return cachedViewer;
  }
  // An fgj without `auth user` prints the auth group's help and exits 0, so only a lone login line counts.
  const stdout = runFgjAuth("user");
  const login = stdout.endsWith("\n") ? ForgejoLogin.safeParse(stdout.slice(0, -1)) : undefined;
  if (!login?.success) {
    throw new Error(
      `Error: installed fgj does not print the stored login with 'fgj auth user'; install the j4k build ${FGJ_AUTH_USER_MINIMUM_BUILD} or newer`,
    );
  }
  cachedViewer = login.data;
  return login.data;
}

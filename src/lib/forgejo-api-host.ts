import { FORGEJO_API_HOST } from "./provider.js";
import { normalizeForgejoApiHost } from "./normalize-forgejo-api-host.js";

export const FORGEJO_API_HOST_ENV_VAR = "PR_FEEDBACK_FORGEJO_API_HOST";

// The default is repoq's canonical host because the tailnet SSH alias is never an HTTP host.
export function forgejoApiHost(): string {
  const override = process.env[FORGEJO_API_HOST_ENV_VAR]?.trim();
  if (!override) {
    return FORGEJO_API_HOST;
  }
  return normalizeForgejoApiHost(override);
}

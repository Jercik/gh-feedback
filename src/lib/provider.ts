import { detectForge } from "repoq";

export { FORGEJO_API_HOST } from "repoq";

type Provider = "github" | "forgejo";

interface ProviderInfo {
  readonly provider: Provider;
  readonly host: string;
  readonly owner: string;
  readonly repo: string;
  /** owner/repo as it exists on this forge */
  readonly slug: string;
}

/**
 * Detect which forge backs a repository from its origin remote URL. repoq owns
 * the URL parsing and host classification; this returns undefined for an
 * unrecognized or unparseable origin so callers reject with a clear message. The
 * slug is per-origin (the Forge drops the `j4k-` affix), never reused across
 * providers.
 */
export function detectProvider(remoteUrl: string): ProviderInfo | undefined {
  const forge = detectForge(remoteUrl);
  if (
    forge.provider === "unknown" ||
    forge.host === null ||
    forge.owner === null ||
    forge.repo === null ||
    forge.slug === null
  ) {
    return undefined;
  }
  return {
    provider: forge.provider,
    host: forge.host,
    owner: forge.owner,
    repo: forge.repo,
    slug: forge.slug,
  };
}

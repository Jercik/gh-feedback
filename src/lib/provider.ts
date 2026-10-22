import { detectForge, FORGEJO_API_HOST } from "@j4k-oss/repoq";

export { FORGEJO_API_HOST } from "@j4k-oss/repoq";

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
 * the URL parsing; this returns undefined for an unrecognized or unparseable
 * origin so callers reject with a clear message. repoq classifies every
 * parseable non-GitHub host as a candidate Forgejo instance, so Forgejo is
 * accepted here only when repoq resolves the origin to the Forge's own API host
 * (code.j4k.dev and its tailnet alias); any other host is unrecognized. The slug
 * is per-origin (the Forge drops the `j4k-` affix), never reused across
 * providers.
 */
export function detectProvider(remoteUrl: string): ProviderInfo | undefined {
  const forge = detectForge(remoteUrl);
  if (
    forge.provider === "unknown" ||
    (forge.provider === "forgejo" && forge.apiHost !== FORGEJO_API_HOST) ||
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

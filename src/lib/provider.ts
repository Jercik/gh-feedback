import { detectForge, FORGEJO_API_HOST } from "@j4k-oss/repoq";

export { FORGEJO_API_HOST } from "@j4k-oss/repoq";

type Provider = "forgejo";

interface ProviderInfo {
  readonly provider: Provider;
  readonly host: string;
  readonly owner: string;
  readonly repo: string;
  readonly slug: string;
}

export function detectProvider(remoteUrl: string): ProviderInfo | undefined {
  const forge = detectForge(remoteUrl);
  if (
    forge.provider !== "forgejo" ||
    forge.apiHost !== FORGEJO_API_HOST ||
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

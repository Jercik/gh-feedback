import { lstatSync, readFileSync } from "node:fs";
import path from "node:path";
import envPaths from "env-paths";
import * as z from "zod";

export interface ReviewServiceCredentials {
  serviceUrl: string;
  token: string;
}

const REVIEW_SERVICE_URL_ENV_VAR = "REVIEW_SERVICE_URL";
const REVIEW_CAPABILITY_TOKEN_ENV_VAR = "REVIEW_CAPABILITY_TOKEN";

const CredentialFile = z.object({ serviceUrl: z.string(), capabilityToken: z.string() });

// Parse failures are reported without their messages, which can quote the file's contents.
function parseCredentialFile(text: string): z.infer<typeof CredentialFile> | undefined {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return undefined;
  }
  const result = CredentialFile.safeParse(json);
  return result.success ? result.data : undefined;
}

export function buildCredentialPath(configDir: string, host: string, slug: string): string {
  if (!/^[a-z0-9.-]+$/u.test(host) || host.split(".").includes("")) {
    throw new Error(`Invalid Forgejo host for a review credential path: ${host}`);
  }
  const parts = slug.split("/");
  const [owner, repo] = parts;
  const component = /^[A-Za-z0-9_.-]+$/u;
  if (
    parts.length !== 2 ||
    owner === undefined ||
    repo === undefined ||
    !component.test(owner) ||
    !component.test(repo) ||
    [owner, repo].some((part) => part === "." || part === "..")
  ) {
    throw new Error(`Invalid repository slug for a review credential path: ${slug}`);
  }
  return path.join(configDir, "repos", host, owner, `${repo}.json`);
}

export function parseServiceOrigin(serviceUrl: string): string {
  let url: URL;
  try {
    url = new URL(serviceUrl);
  } catch {
    throw new Error("Review service URL is not a valid URL");
  }
  if (
    url.protocol !== "https:" ||
    url.username !== "" ||
    url.password !== "" ||
    url.pathname !== "/" ||
    url.search !== "" ||
    url.hash !== ""
  ) {
    throw new Error("Review service URL must be a credential-free https origin");
  }
  return url.origin;
}

export function loadReviewServiceCredentials(host: string, slug: string): ReviewServiceCredentials {
  const envUrl = process.env[REVIEW_SERVICE_URL_ENV_VAR];
  const envToken = process.env[REVIEW_CAPABILITY_TOKEN_ENV_VAR];
  if ((envUrl === undefined) !== (envToken === undefined)) {
    throw new Error(
      `${REVIEW_SERVICE_URL_ENV_VAR} and ${REVIEW_CAPABILITY_TOKEN_ENV_VAR} must be provided together`,
    );
  }
  if (envUrl !== undefined && envToken !== undefined) {
    return { serviceUrl: parseServiceOrigin(envUrl), token: envToken };
  }

  const file = buildCredentialPath(envPaths("j4k-review", { suffix: "" }).config, host, slug);
  let stats;
  try {
    stats = lstatSync(file);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      throw new Error(
        `No review service credential for ${slug} on ${host}: expected ${file}, or set ` +
          `${REVIEW_SERVICE_URL_ENV_VAR} and ${REVIEW_CAPABILITY_TOKEN_ENV_VAR}`,
        { cause: error },
      );
    }
    throw error;
  }
  if (!stats.isFile()) {
    throw new Error(`Review credential ${file} must be a regular file`);
  }
  if (process.platform !== "win32" && stats.mode % 0o100 !== 0) {
    throw new Error(`Review credential ${file} is accessible to others; run: chmod 600 ${file}`);
  }
  const parsed = parseCredentialFile(readFileSync(file, "utf8"));
  if (parsed === undefined) {
    throw new Error(
      `Review credential ${file} is not valid: expected JSON {"serviceUrl": "...", "capabilityToken": "..."}`,
    );
  }
  return { serviceUrl: parseServiceOrigin(parsed.serviceUrl), token: parsed.capabilityToken };
}

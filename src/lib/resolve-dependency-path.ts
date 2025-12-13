interface DependencyPathOptions {
  defaultPath: string;
  envOverride: string | undefined;
}

export function resolveDependencyPath(options: DependencyPathOptions): string {
  const trimmedOverride = options.envOverride?.trim();
  return trimmedOverride || options.defaultPath;
}

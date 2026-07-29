export interface BuildInfo {
  sha: string;
  ref: string;
  builtAt: string;
}

export const currentBuildInfo: BuildInfo = {
  sha: import.meta.env.VITE_BUILD_SHA?.trim() || "local",
  ref: import.meta.env.VITE_BUILD_REF?.trim() || "local",
  builtAt: import.meta.env.VITE_BUILD_TIME?.trim() || "development",
};

export function isDifferentDeployedBuild(
  current: BuildInfo,
  deployed: BuildInfo,
) {
  return (
    current.sha !== "local" &&
    deployed.sha !== "local" &&
    current.sha !== deployed.sha
  );
}

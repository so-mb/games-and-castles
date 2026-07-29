import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  currentBuildInfo,
  isDifferentDeployedBuild,
  type BuildInfo,
} from "../../lib/buildInfo";
import { fetchDeployedBuild } from "./versionMetadata";

const VERSION_POLL_MS = 5 * 60 * 1000;

interface VersionContextValue {
  current: BuildInfo;
  deployed: BuildInfo | null;
  status: "idle" | "checking" | "current" | "update-available" | "error";
  checkedAt: number | null;
  check: () => Promise<void>;
}

const VersionContext = createContext<VersionContextValue | null>(null);

export function VersionProvider({ children }: { children: ReactNode }) {
  const [deployed, setDeployed] = useState<BuildInfo | null>(null);
  const [status, setStatus] = useState<VersionContextValue["status"]>("idle");
  const [checkedAt, setCheckedAt] = useState<number | null>(null);

  const check = useCallback(async () => {
    if (!import.meta.env.PROD || document.visibilityState === "hidden") return;
    setStatus("checking");
    try {
      const next = await fetchDeployedBuild(
        fetch,
        import.meta.env.BASE_URL,
        Date.now(),
      );
      setDeployed(next);
      setCheckedAt(Date.now());
      setStatus(
        isDifferentDeployedBuild(currentBuildInfo, next)
          ? "update-available"
          : "current",
      );
    } catch {
      setCheckedAt(Date.now());
      setStatus("error");
    }
  }, []);

  useEffect(() => {
    if (!import.meta.env.PROD) return;
    const initial = window.setTimeout(() => void check(), 0);
    const interval = window.setInterval(() => void check(), VERSION_POLL_MS);
    const visible = () => {
      if (document.visibilityState === "visible") void check();
    };
    document.addEventListener("visibilitychange", visible);
    return () => {
      window.clearTimeout(initial);
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", visible);
    };
  }, [check]);

  const value = useMemo(
    () => ({ current: currentBuildInfo, deployed, status, checkedAt, check }),
    [checkedAt, check, deployed, status],
  );
  return (
    <VersionContext.Provider value={value}>{children}</VersionContext.Provider>
  );
}

// Hooks intentionally share this module with their provider.
// eslint-disable-next-line react-refresh/only-export-components
export function useVersion() {
  const value = useContext(VersionContext);
  if (!value) throw new Error("useVersion must be used within VersionProvider");
  return value;
}

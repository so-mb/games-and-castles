import { RefreshCw } from "lucide-react";
import { Button } from "../../components/ui/Button";
import { useVersion } from "./VersionProvider";

export function VersionUpdateBanner() {
  const version = useVersion();
  if (version.status !== "update-available") return null;

  return (
    <aside
      className="fixed right-3 bottom-16 z-50 max-w-[calc(100vw-1.5rem)] rounded-2xl border border-[var(--color-electric-cyan-400)]/35 bg-[var(--color-night-900)] p-4 text-sm text-white shadow-2xl sm:max-w-sm"
      role="status"
    >
      <p className="font-bold">A newer Games &amp; Castles build is live.</p>
      <p className="mt-1 text-white/60">
        Reload when you are ready. Unsaved form input will be lost.
      </p>
      <Button
        className="mt-3"
        onClick={() => window.location.reload()}
        variant="dark"
      >
        <RefreshCw aria-hidden="true" size={16} /> Reload latest build
      </Button>
    </aside>
  );
}

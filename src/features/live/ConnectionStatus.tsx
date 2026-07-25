import { Cloud, CloudOff, LoaderCircle } from "lucide-react";
import { useConnection } from "./ConnectionProvider";
import { useFirebase } from "./FirebaseProvider";

export function ConnectionStatus() {
  const firebase = useFirebase();
  const connection = useConnection();
  if (firebase.status !== "ready" || connection === "online") return null;

  const details = {
    connecting: { label: "Connecting", Icon: LoaderCircle },
    online: { label: "Live", Icon: Cloud },
    offline: { label: "Offline", Icon: CloudOff },
    unconfigured: { label: "", Icon: CloudOff },
  }[connection];

  return (
    <div
      className="fixed right-3 bottom-3 z-40 flex items-center gap-2 rounded-full border border-white/12 bg-[var(--color-night-900)]/95 px-3 py-2 text-xs font-bold text-white shadow-lg"
      role="status"
    >
      <details.Icon
        aria-hidden="true"
        className={connection === "connecting" ? "animate-spin" : ""}
        size={15}
      />
      {details.label}
    </div>
  );
}

import type { ReactNode } from "react";
import { Clock3, LogOut } from "lucide-react";
import { Button } from "../../components/ui/Button";
import { Modal } from "../../components/ui/Modal";
import { useAuth } from "./AuthProvider";

export function OrganizerSessionGuard({ children }: { children: ReactNode }) {
  const auth = useAuth();
  const remainingMinutes = Math.max(
    1,
    Math.ceil(auth.organizerSession.remainingMs / 60_000),
  );

  return (
    <>
      {children}
      <Modal
        description={`Organizer Mode will sign out after ${remainingMinutes} minute${remainingMinutes === 1 ? "" : "s"} without activity. Guest access in this browser is unaffected.`}
        onClose={auth.staySignedIn}
        open={auth.organizerSession.status === "warning"}
        title="Organizer session expiring"
      >
        <div className="rounded-2xl border border-[var(--color-antique-gold-400)]/25 bg-[var(--color-antique-gold-400)]/7 p-4 text-sm leading-6 text-white/70">
          <p className="flex items-center gap-2 font-bold text-white">
            <Clock3 aria-hidden="true" size={18} />
            Activity timeout protection
          </p>
          <p className="mt-1">
            Continue only if you are still using this organizer device.
          </p>
        </div>
        <div className="mt-5 flex flex-wrap justify-end gap-3">
          <Button
            className="text-white"
            onClick={() => void auth.signOutOrganizer()}
            variant="quiet"
          >
            <LogOut aria-hidden="true" size={17} /> Sign out now
          </Button>
          <Button onClick={auth.staySignedIn} variant="dark">
            Stay signed in
          </Button>
        </div>
      </Modal>
    </>
  );
}

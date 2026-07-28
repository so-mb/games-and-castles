import { useState } from "react";
import { Eye, EyeOff, ShieldCheck } from "lucide-react";
import { Button } from "../../../components/ui/Button";
import { IconButton } from "../../../components/ui/IconButton";
import { Modal } from "../../../components/ui/Modal";
import { friendlyFirebaseError } from "../../../lib/firebase/errors";
import type { RecentRevealAuthorization } from "../../auth/specialRevealAuthorization";

interface SensitiveActionDialogProps {
  open: boolean;
  title: string;
  consequence: string;
  confirmationPhrase: string;
  organizerEmail: string;
  online: boolean;
  onCancel: () => void;
  onReauthenticate: (password: string) => Promise<RecentRevealAuthorization>;
  onExecute: (authorization: RecentRevealAuthorization) => Promise<void>;
  onSuccess: () => void;
}

export function SensitiveActionDialog({
  open,
  ...props
}: SensitiveActionDialogProps) {
  if (!open) return null;
  return <OpenSensitiveActionDialog {...props} />;
}

function OpenSensitiveActionDialog({
  title,
  consequence,
  confirmationPhrase,
  organizerEmail,
  online,
  onCancel,
  onReauthenticate,
  onExecute,
  onSuccess,
}: Omit<SensitiveActionDialogProps, "open">) {
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function close() {
    if (busy) return;
    setPassword("");
    setConfirmation("");
    setError(null);
    onCancel();
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (
      busy ||
      !online ||
      confirmation !== confirmationPhrase ||
      password.length === 0
    )
      return;
    setBusy(true);
    setError(null);
    try {
      const authorization = await onReauthenticate(password);
      setPassword("");
      await onExecute(authorization);
      setConfirmation("");
      onSuccess();
      onCancel();
    } catch (cause) {
      setPassword("");
      setError(
        friendlyFirebaseError(
          cause,
          cause instanceof Error
            ? cause.message
            : "The protected operation was not completed.",
        ),
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      description="Confirm the consequence, then reauthenticate the currently signed-in reveal organizer."
      onClose={close}
      open
      title={title}
    >
      <form className="space-y-5" onSubmit={submit}>
        <div className="rounded-2xl border border-[var(--color-antique-gold-400)]/25 bg-[var(--color-antique-gold-400)]/7 p-4 text-sm leading-6 text-white/70">
          <p className="flex items-center gap-2 font-extrabold text-white">
            <ShieldCheck aria-hidden="true" size={18} />
            Sensitive reveal operation
          </p>
          <p className="mt-1">{consequence}</p>
        </div>

        <label className="block text-sm font-bold">
          Organizer email
          <input
            autoComplete="username"
            className="mt-2 min-h-12 w-full rounded-xl border border-white/12 bg-white/4 px-4 text-white/65"
            readOnly
            type="email"
            value={organizerEmail}
          />
        </label>

        <label className="block text-sm font-bold">
          Current organizer password
          <span className="relative mt-2 block">
            <input
              autoComplete="current-password"
              className="min-h-12 w-full rounded-xl border border-white/15 bg-white/7 px-4 pr-14 text-base outline-none focus:border-[var(--color-electric-cyan-400)] focus:ring-3 focus:ring-[var(--color-electric-cyan-400)]/18"
              disabled={busy || !online}
              onChange={(event) => setPassword(event.target.value)}
              required
              type={showPassword ? "text" : "password"}
              value={password}
            />
            <IconButton
              className="absolute top-1/2 right-1.5 -translate-y-1/2 border-transparent text-white/70"
              disabled={busy}
              label={showPassword ? "Hide password" : "Show password"}
              onClick={() => setShowPassword((current) => !current)}
              type="button"
            >
              {showPassword ? (
                <EyeOff aria-hidden="true" size={18} />
              ) : (
                <Eye aria-hidden="true" size={18} />
              )}
            </IconButton>
          </span>
        </label>

        <label className="block text-sm font-bold">
          Type {confirmationPhrase} to continue
          <input
            autoComplete="off"
            className="mt-2 min-h-12 w-full rounded-xl border border-white/15 bg-white/7 px-4 text-base outline-none focus:border-[var(--color-electric-cyan-400)] focus:ring-3 focus:ring-[var(--color-electric-cyan-400)]/18"
            disabled={busy || !online}
            onChange={(event) => setConfirmation(event.target.value)}
            required
            value={confirmation}
          />
        </label>

        {!online ? (
          <p
            className="rounded-xl border border-[#ff9ca1]/30 bg-[#ff9ca1]/8 px-4 py-3 text-sm text-[#ffc3c6]"
            role="alert"
          >
            Reconnect before confirming a protected operation.
          </p>
        ) : null}
        {error ? (
          <p
            className="rounded-xl border border-[#ff9ca1]/30 bg-[#ff9ca1]/8 px-4 py-3 text-sm text-[#ffc3c6]"
            role="alert"
          >
            {error}
          </p>
        ) : null}

        <div className="flex flex-wrap justify-end gap-3">
          <Button disabled={busy} onClick={close} type="button" variant="quiet">
            Cancel
          </Button>
          <Button
            disabled={
              busy ||
              !online ||
              !password ||
              confirmation !== confirmationPhrase
            }
            type="submit"
            variant="dark"
          >
            {busy ? "Reauthenticating…" : "Reauthenticate and continue"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

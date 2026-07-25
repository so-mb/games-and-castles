import { useState } from "react";
import { Radio, WifiOff } from "lucide-react";
import { EmptyState } from "../../components/feedback/EmptyState";
import { Button } from "../../components/ui/Button";
import { Modal } from "../../components/ui/Modal";
import { ParticipantAvatar } from "../../components/ui/ParticipantAvatar";
import { StatusBadge } from "../../components/ui/StatusBadge";
import { Surface } from "../../components/ui/Surface";
import { useAuth } from "../auth/AuthProvider";
import { useConnection } from "../live/ConnectionProvider";
import { useFirebase } from "../live/FirebaseProvider";
import { ParticipantForm } from "./ParticipantForm";
import { useParticipants } from "./ParticipantsProvider";

function initials(name: string) {
  return name
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export function ParticipantLivePanel() {
  const firebase = useFirebase();
  const auth = useAuth();
  const connection = useConnection();
  const participants = useParticipants();
  const [editorOpen, setEditorOpen] = useState(false);

  if (firebase.status === "unconfigured") {
    return (
      <Surface className="p-5 sm:p-6" variant="championship">
        <StatusBadge tone="neutral">Live area not configured</StatusBadge>
        <h3 className="mt-4 text-2xl font-extrabold">
          The guest list is waiting backstage
        </h3>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-white/58">
          Static trip details and previews remain available. Add the public
          Firebase configuration to enable guest joining and the shared roster.
        </p>
      </Surface>
    );
  }

  if (firebase.status === "error" || auth.guest.status === "error") {
    return (
      <Surface className="p-5 sm:p-6" variant="championship">
        <StatusBadge tone="neutral">Live area unavailable</StatusBadge>
        <h3 className="mt-4 text-2xl font-extrabold">
          The static weekend page is still ready
        </h3>
        <p className="mt-2 text-sm leading-6 text-white/58">
          {auth.guest.status === "error"
            ? auth.guest.message
            : "Firebase could not start in this browser."}
        </p>
      </Surface>
    );
  }

  const loading =
    auth.guest.status === "loading" ||
    participants.activeState === "loading" ||
    participants.ownState === "loading";

  return (
    <Surface className="overflow-hidden" variant="live">
      <div className="border-b border-white/9 p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge tone="live">Live participant roster</StatusBadge>
              <span className="text-xs font-semibold text-white/45">
                {participants.activeParticipants.length} active
              </span>
              {firebase.config.useEmulators && import.meta.env.DEV ? (
                <span className="rounded-full bg-[var(--color-electric-cyan-400)]/12 px-2 py-1 text-[10px] font-bold tracking-[0.08em] text-[var(--color-electric-cyan-400)] uppercase">
                  Emulator
                </span>
              ) : null}
            </div>
            <h3 className="mt-4 text-2xl font-extrabold">
              Who’s at the table?
            </h3>
            <p className="mt-2 max-w-xl text-sm leading-6 text-white/58">
              Join once in this browser, then choose a friendly display name and
              avatar for the shared weekend roster.
            </p>
          </div>
          {participants.ownParticipant ? (
            <Button onClick={() => setEditorOpen(true)} variant="dark">
              Edit my profile
            </Button>
          ) : (
            <Button
              disabled={loading || !participants.canMutate}
              onClick={() => setEditorOpen(true)}
              variant="dark"
            >
              Join the games
            </Button>
          )}
        </div>

        {connection === "offline" ? (
          <p
            className="mt-4 flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/65"
            role="status"
          >
            <WifiOff aria-hidden="true" size={17} />
            You can keep browsing. Changes resume when the live connection
            returns.
          </p>
        ) : null}
        {participants.errorMessage ? (
          <p
            className="mt-4 rounded-xl border border-[#ff9ca1]/25 bg-[#ff9ca1]/8 px-4 py-3 text-sm text-[#ffc3c6]"
            role="alert"
          >
            {participants.errorMessage}
          </p>
        ) : null}
      </div>

      <div className="p-5 sm:p-6">
        {loading ? (
          <div
            aria-live="polite"
            className="flex min-h-28 items-center justify-center gap-3 text-sm text-white/55"
          >
            <Radio aria-hidden="true" className="animate-pulse" size={18} />
            Connecting to the guest list…
          </div>
        ) : participants.activeParticipants.length === 0 ? (
          <EmptyState
            description="Be the first to join from this browser. No sample names are shown as live data."
            icon="users"
            title="No participants yet"
          />
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {participants.activeParticipants.map((participant) => (
              <li
                className="flex items-center gap-3 rounded-2xl border border-white/9 bg-white/[0.035] p-3"
                key={participant.id}
              >
                <ParticipantAvatar
                  accent={participant.avatar.tone}
                  icon={participant.avatar.icon}
                  initials={initials(participant.displayName)}
                  name={participant.displayName}
                />
                <span className="min-w-0">
                  <span className="block truncate text-sm font-bold">
                    {participant.displayName}
                  </span>
                  <span className="block text-xs text-white/42">
                    {participant.id === participants.ownParticipant?.id
                      ? "You · this browser"
                      : "Weekend participant"}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <Modal
        description={
          participants.ownParticipant
            ? "Update the public name and avatar linked to this browser."
            : "This creates an anonymous browser-local identity. There is no account recovery in this phase."
        }
        onClose={() => setEditorOpen(false)}
        open={editorOpen}
        title={
          participants.ownParticipant
            ? "Edit my participant"
            : "Join the weekend"
        }
      >
        <ParticipantForm
          disabled={!participants.canMutate}
          excludedParticipantId={participants.ownParticipant?.id}
          initialValue={
            participants.ownParticipant
              ? {
                  displayName: participants.ownParticipant.displayName,
                  avatar: participants.ownParticipant.avatar,
                }
              : undefined
          }
          onCancel={() => setEditorOpen(false)}
          onSubmit={async (input) => {
            if (participants.ownParticipant)
              await participants.updateOwn(input);
            else await participants.createOwn(input);
            setEditorOpen(false);
          }}
          participants={participants.activeParticipants}
          submitLabel={
            participants.ownParticipant ? "Save profile" : "Join roster"
          }
        />
      </Modal>
    </Surface>
  );
}

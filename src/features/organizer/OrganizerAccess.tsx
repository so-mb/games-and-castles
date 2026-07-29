import { lazy, Suspense, useState } from "react";
import {
  LogOut,
  Settings2,
  ShieldCheck,
  Trophy,
  Award,
  Activity,
  CakeSlice,
  LockKeyhole,
  UserPlus,
  UsersRound,
} from "lucide-react";
import { Button } from "../../components/ui/Button";
import { Modal } from "../../components/ui/Modal";
import { ParticipantAvatar } from "../../components/ui/ParticipantAvatar";
import { StatusBadge } from "../../components/ui/StatusBadge";
import { cn } from "../../lib/cn";
import { useAuth } from "../auth/AuthProvider";
import { useFirebase } from "../live/FirebaseProvider";
import { ParticipantForm } from "../participants/ParticipantForm";
import { useParticipants } from "../participants/ParticipantsProvider";
import type { Participant } from "../participants/types";

const CompetitionStudio = lazy(() =>
  import("../competitions/organizer/CompetitionStudio").then((module) => ({
    default: module.CompetitionStudio,
  })),
);

const ChampionshipDesk = lazy(() =>
  import("../championship/organizer/ChampionshipDesk").then((module) => ({
    default: module.ChampionshipDesk,
  })),
);

const BirthdayVaultWorkspace = lazy(() =>
  import("../birthday-vault/organizer/BirthdayVaultWorkspace").then(
    (module) => ({ default: module.BirthdayVaultWorkspace }),
  ),
);

const SpecialRevealWorkspace = lazy(() =>
  import("../special-reveal/organizer/SpecialRevealWorkspace").then(
    (module) => ({ default: module.SpecialRevealWorkspace }),
  ),
);

const OperationsWorkspace = lazy(() =>
  import("../operations/OperationsWorkspace").then((module) => ({
    default: module.OperationsWorkspace,
  })),
);

function initials(name: string) {
  return name
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function workspaceTabClass(active: boolean) {
  return cn(
    "inline-flex min-h-11 shrink-0 items-center gap-2 rounded-xl border px-3.5 text-sm leading-5 font-bold transition-[color,background-color,border-color,box-shadow] duration-[var(--motion-fast)] ease-out focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-[var(--color-electric-cyan-400)] [&>svg]:shrink-0",
    active
      ? "border-[var(--color-electric-cyan-400)]/70 bg-[var(--color-electric-cyan-400)]/12 text-[var(--color-electric-cyan-400)] shadow-[inset_0_0_0_1px_rgb(54_214_208_/_8%)]"
      : "border-transparent text-white/58 hover:border-white/10 hover:bg-white/6 hover:text-white/82",
  );
}

export function OrganizerAccess() {
  const firebase = useFirebase();
  const auth = useAuth();
  const participants = useParticipants();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [editor, setEditor] = useState<"add" | Participant | null>(null);
  const [pendingStatusId, setPendingStatusId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [activeTool, setActiveTool] = useState<
    | "participants"
    | "competitions"
    | "championship"
    | "birthday"
    | "special-reveal"
    | "operations"
  >("competitions");

  if (firebase.status !== "ready") return null;

  async function handleSignIn(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setLoginError(null);
    try {
      await auth.signInOrganizer(email, password);
      setPassword("");
    } catch (error) {
      setLoginError(
        error instanceof Error ? error.message : "Organizer sign-in failed.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  const authorized = auth.organizer.status === "authorized";
  const specialRevealAccess =
    auth.organizer.status === "authorized" && auth.organizer.specialRevealAdmin;
  const triggerLabel = authorized ? "Studio" : "Organizer";

  return (
    <>
      <Button
        aria-label={
          authorized ? "Open Organizer Mode — signed in" : "Open Organizer Mode"
        }
        className="size-11 shrink-0 border border-white/12 !p-0 text-white hover:bg-white/8 md:h-auto md:w-auto md:!px-4 md:!py-2.5"
        onClick={() => setOpen(true)}
        variant="quiet"
      >
        <Settings2 aria-hidden="true" size={17} />
        <span className="sr-only md:not-sr-only">{triggerLabel}</span>
      </Button>
      <Modal
        description="Organizer tools use a separate sign-in and never replace the anonymous guest identity stored in this browser."
        onClose={() => {
          setOpen(false);
          setEditor(null);
          setPendingStatusId(null);
        }}
        open={open}
        size={authorized ? "wide" : "default"}
        title={authorized ? "Organizer console" : "Organizer access"}
      >
        {!authorized ? (
          <form className="space-y-5" onSubmit={handleSignIn}>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm leading-6 text-white/60">
              <p className="flex items-center gap-2 font-bold text-white">
                <ShieldCheck aria-hidden="true" size={18} />
                Approved organizers only
              </p>
              <p className="mt-1">
                Email and password sign-in is available only for accounts with
                the server-issued admin claim. There is no public sign-up or
                password reset here.
              </p>
            </div>
            <label className="block text-sm font-bold">
              Email
              <input
                autoComplete="username"
                className="mt-2 min-h-12 w-full rounded-xl border border-white/15 bg-white/7 px-4 text-base outline-none focus:border-[var(--color-electric-cyan-400)] focus:ring-3 focus:ring-[var(--color-electric-cyan-400)]/18"
                disabled={submitting}
                onChange={(event) => setEmail(event.target.value)}
                required
                type="email"
                value={email}
              />
            </label>
            <label className="block text-sm font-bold">
              Password
              <input
                autoComplete="current-password"
                className="mt-2 min-h-12 w-full rounded-xl border border-white/15 bg-white/7 px-4 text-base outline-none focus:border-[var(--color-electric-cyan-400)] focus:ring-3 focus:ring-[var(--color-electric-cyan-400)]/18"
                disabled={submitting}
                onChange={(event) => setPassword(event.target.value)}
                required
                type="password"
                value={password}
              />
            </label>
            {loginError || auth.organizer.status === "error" ? (
              <p
                className="rounded-xl border border-[#ff9ca1]/30 bg-[#ff9ca1]/8 px-4 py-3 text-sm text-[#ffc3c6]"
                role="alert"
              >
                {loginError ?? auth.organizer.message}
              </p>
            ) : null}
            <Button
              className="w-full"
              disabled={submitting || auth.organizer.status === "checking"}
              type="submit"
              variant="dark"
            >
              {submitting || auth.organizer.status === "checking"
                ? "Verifying access…"
                : "Sign in as organizer"}
            </Button>
          </form>
        ) : (
          <div>
            <div className="mb-8 space-y-4 border-b border-white/10 pb-6">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-bold text-white">
                    Organizer workspaces
                  </p>
                  <p className="mt-1 text-xs leading-5 text-white/48">
                    Choose a tool without leaving the console.
                  </p>
                </div>
                <Button
                  className="shrink-0 px-3 sm:px-4"
                  onClick={() => void auth.signOutOrganizer()}
                  variant="quiet"
                >
                  <LogOut aria-hidden="true" size={17} />
                  Sign out
                </Button>
              </div>
              <div className="organizer-tab-scroll -mx-1 overflow-x-auto px-1 pb-2">
                <div
                  aria-label="Organizer workspaces"
                  className="flex w-max min-w-full gap-1.5 rounded-2xl border border-white/8 bg-black/12 p-1.5"
                  role="tablist"
                >
                  <button
                    aria-controls="organizer-panel-operations"
                    aria-selected={activeTool === "operations"}
                    className={workspaceTabClass(activeTool === "operations")}
                    id="organizer-tab-operations"
                    onClick={() => {
                      setEditor(null);
                      setActiveTool("operations");
                    }}
                    role="tab"
                    type="button"
                  >
                    <Activity aria-hidden="true" size={17} />
                    Operations
                  </button>
                  {specialRevealAccess ? (
                    <button
                      aria-controls="organizer-panel-special-reveal"
                      aria-selected={activeTool === "special-reveal"}
                      className={workspaceTabClass(
                        activeTool === "special-reveal",
                      )}
                      id="organizer-tab-special-reveal"
                      onClick={() => {
                        setEditor(null);
                        setActiveTool("special-reveal");
                      }}
                      role="tab"
                      type="button"
                    >
                      <LockKeyhole aria-hidden="true" size={17} />
                      Special Reveal
                    </button>
                  ) : null}
                  <button
                    aria-controls="organizer-panel-birthday"
                    aria-selected={activeTool === "birthday"}
                    className={workspaceTabClass(activeTool === "birthday")}
                    id="organizer-tab-birthday"
                    onClick={() => {
                      setEditor(null);
                      setActiveTool("birthday");
                    }}
                    role="tab"
                    type="button"
                  >
                    <CakeSlice aria-hidden="true" size={17} />
                    Birthday Vault
                  </button>
                  <button
                    aria-controls="organizer-panel-championship"
                    aria-selected={activeTool === "championship"}
                    className={workspaceTabClass(activeTool === "championship")}
                    id="organizer-tab-championship"
                    onClick={() => {
                      setEditor(null);
                      setActiveTool("championship");
                    }}
                    role="tab"
                    type="button"
                  >
                    <Award aria-hidden="true" size={17} />
                    Championship Desk
                  </button>
                  <button
                    aria-controls="organizer-panel-competitions"
                    aria-selected={activeTool === "competitions"}
                    className={workspaceTabClass(activeTool === "competitions")}
                    id="organizer-tab-competitions"
                    onClick={() => {
                      setEditor(null);
                      setActiveTool("competitions");
                    }}
                    role="tab"
                    type="button"
                  >
                    <Trophy aria-hidden="true" size={17} />
                    Competition Studio
                  </button>
                  <button
                    aria-controls="organizer-panel-participants"
                    aria-selected={activeTool === "participants"}
                    className={workspaceTabClass(activeTool === "participants")}
                    id="organizer-tab-participants"
                    onClick={() => setActiveTool("participants")}
                    role="tab"
                    type="button"
                  >
                    <UsersRound aria-hidden="true" size={17} />
                    Participant Control
                  </button>
                </div>
              </div>
            </div>

            {activeTool === "operations" ? (
              <div
                aria-labelledby="organizer-tab-operations"
                id="organizer-panel-operations"
                role="tabpanel"
              >
                <Suspense
                  fallback={
                    <p
                      className="py-12 text-center text-sm text-white/55"
                      role="status"
                    >
                      Opening Operations…
                    </p>
                  }
                >
                  <OperationsWorkspace
                    onOpenWorkspace={(workspace) => setActiveTool(workspace)}
                  />
                </Suspense>
              </div>
            ) : activeTool === "special-reveal" && specialRevealAccess ? (
              <div
                aria-labelledby="organizer-tab-special-reveal"
                id="organizer-panel-special-reveal"
                role="tabpanel"
              >
                <Suspense
                  fallback={
                    <p
                      className="py-12 text-center text-sm text-white/55"
                      role="status"
                    >
                      Opening Special Reveal controls…
                    </p>
                  }
                >
                  <SpecialRevealWorkspace />
                </Suspense>
              </div>
            ) : activeTool === "competitions" ? (
              <div
                aria-labelledby="organizer-tab-competitions"
                id="organizer-panel-competitions"
                role="tabpanel"
              >
                <Suspense
                  fallback={
                    <p
                      className="py-12 text-center text-sm text-white/55"
                      role="status"
                    >
                      Opening Competition Studio…
                    </p>
                  }
                >
                  <CompetitionStudio />
                </Suspense>
              </div>
            ) : activeTool === "championship" ? (
              <div
                aria-labelledby="organizer-tab-championship"
                id="organizer-panel-championship"
                role="tabpanel"
              >
                <Suspense
                  fallback={
                    <p
                      className="py-12 text-center text-sm text-white/55"
                      role="status"
                    >
                      Opening Championship Desk…
                    </p>
                  }
                >
                  <ChampionshipDesk />
                </Suspense>
              </div>
            ) : activeTool === "birthday" ? (
              <div
                aria-labelledby="organizer-tab-birthday"
                id="organizer-panel-birthday"
                role="tabpanel"
              >
                <Suspense
                  fallback={
                    <p
                      className="py-12 text-center text-sm text-white/55"
                      role="status"
                    >
                      Opening Birthday Vault…
                    </p>
                  }
                >
                  <BirthdayVaultWorkspace />
                </Suspense>
              </div>
            ) : (
              <div
                aria-labelledby="organizer-tab-participants"
                id="organizer-panel-participants"
                role="tabpanel"
              >
                {editor ? (
                  <ParticipantForm
                    disabled={!participants.canMutate}
                    excludedParticipantId={
                      editor === "add" ? undefined : editor.id
                    }
                    initialValue={
                      editor === "add"
                        ? undefined
                        : {
                            displayName: editor.displayName,
                            avatar: editor.avatar,
                          }
                    }
                    onCancel={() => setEditor(null)}
                    onSubmit={async (input) => {
                      if (editor === "add")
                        await participants.organizerCreate(input);
                      else await participants.organizerUpdate(editor.id, input);
                      setEditor(null);
                    }}
                    participants={participants.organizerParticipants}
                    submitLabel={
                      editor === "add" ? "Add participant" : "Save participant"
                    }
                  />
                ) : (
                  <div>
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <StatusBadge tone="live">
                          Organizer verified
                        </StatusBadge>
                        <p className="mt-2 text-sm text-white/50">
                          {participants.organizerParticipants.length}{" "}
                          participant records
                        </p>
                      </div>
                      <Button
                        disabled={!participants.canMutate}
                        onClick={() => setEditor("add")}
                        variant="dark"
                      >
                        <UserPlus aria-hidden="true" size={17} />
                        Add participant
                      </Button>
                    </div>

                    {actionError ? (
                      <p
                        className="mt-4 rounded-xl border border-[#ff9ca1]/30 bg-[#ff9ca1]/8 px-4 py-3 text-sm text-[#ffc3c6]"
                        role="alert"
                      >
                        {actionError}
                      </p>
                    ) : null}

                    {participants.organizerState === "loading" ? (
                      <p
                        className="py-10 text-center text-sm text-white/55"
                        role="status"
                      >
                        Loading participant records…
                      </p>
                    ) : participants.organizerParticipants.length === 0 ? (
                      <p className="mt-5 rounded-2xl border border-dashed border-white/15 p-6 text-center text-sm text-white/55">
                        No participant records yet.
                      </p>
                    ) : (
                      <ul className="mt-5 space-y-3">
                        {participants.organizerParticipants.map(
                          (participant) => {
                            const changingStatus =
                              pendingStatusId === participant.id;
                            const nextStatus =
                              participant.status === "active"
                                ? "inactive"
                                : "active";
                            return (
                              <li
                                className="rounded-2xl border border-white/10 bg-white/[0.035] p-4"
                                key={participant.id}
                              >
                                <div className="flex flex-wrap items-center gap-3">
                                  <ParticipantAvatar
                                    accent={participant.avatar.tone}
                                    icon={participant.avatar.icon}
                                    initials={initials(participant.displayName)}
                                    name={participant.displayName}
                                  />
                                  <div className="min-w-0 flex-1">
                                    <p className="truncate text-sm font-bold">
                                      {participant.displayName}
                                    </p>
                                    <p className="text-xs text-white/42">
                                      {participant.ownerUid
                                        ? "Guest-owned"
                                        : "Organizer-added"}{" "}
                                      · {participant.status}
                                    </p>
                                  </div>
                                  <Button
                                    onClick={() => setEditor(participant)}
                                    variant="quiet"
                                  >
                                    Edit
                                  </Button>
                                  <Button
                                    disabled={!participants.canMutate}
                                    onClick={() =>
                                      setPendingStatusId(
                                        changingStatus ? null : participant.id,
                                      )
                                    }
                                    variant="quiet"
                                  >
                                    {participant.status === "active"
                                      ? "Deactivate"
                                      : "Reactivate"}
                                  </Button>
                                </div>
                                {changingStatus ? (
                                  <div className="mt-3 flex flex-wrap items-center justify-end gap-3 border-t border-white/8 pt-3">
                                    <p className="mr-auto text-xs text-white/52">
                                      {nextStatus === "inactive"
                                        ? "Remove this person from the public active roster?"
                                        : "Return this person to the public active roster?"}
                                    </p>
                                    <Button
                                      onClick={() => setPendingStatusId(null)}
                                      variant="quiet"
                                    >
                                      Cancel
                                    </Button>
                                    <Button
                                      onClick={() => {
                                        setActionError(null);
                                        void participants
                                          .organizerSetStatus(
                                            participant.id,
                                            nextStatus,
                                          )
                                          .then(() => setPendingStatusId(null))
                                          .catch((error: unknown) =>
                                            setActionError(
                                              error instanceof Error
                                                ? error.message
                                                : "The participant status could not be changed.",
                                            ),
                                          );
                                      }}
                                      variant="dark"
                                    >
                                      Confirm
                                    </Button>
                                  </div>
                                ) : null}
                              </li>
                            );
                          },
                        )}
                      </ul>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </Modal>
    </>
  );
}

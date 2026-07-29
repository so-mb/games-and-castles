import { lazy, Suspense, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  BookHeart,
  LockKeyhole,
  Mail,
  PenLine,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { Reveal } from "../../components/feedback/Reveal";
import { SectionShell } from "../../components/layout/SectionShell";
import { Button } from "../../components/ui/Button";
import { SectionHeading } from "../../components/ui/SectionHeading";
import { StatusBadge } from "../../components/ui/StatusBadge";
import { useFirebase } from "../live/FirebaseProvider";
import { useParticipants } from "../participants/ParticipantsProvider";
import { useBirthdayVault } from "./BirthdayVaultProvider";
import { birthdayEmojiSymbol } from "./domain/emoji";
import type { BirthdayMessage } from "./domain/types";
import { BirthdayMessageForm } from "./submission/BirthdayMessageForm";

const BirthdayVaultPresentation = lazy(() =>
  import("./presentation/BirthdayVaultPresentation").then((module) => ({
    default: module.BirthdayVaultPresentation,
  })),
);

const revealStorageKey = "games-and-castles:birthday-vault-seen-revision";

function readSeenRevealRevision() {
  try {
    if (typeof window.localStorage?.getItem !== "function") return 0;
    return Number(window.localStorage.getItem(revealStorageKey) ?? 0);
  } catch {
    return 0;
  }
}

function rememberRevealRevision(revision: number) {
  try {
    if (typeof window.localStorage?.setItem === "function") {
      window.localStorage.setItem(revealStorageKey, String(revision));
    }
  } catch {
    // Presentation memory is optional and never affects shared reveal state.
  }
}

function OwnerMessageCard({ message }: { message: BirthdayMessage }) {
  return (
    <article className="birthday-message-card rounded-3xl border border-[var(--color-antique-gold-400)]/45 bg-[var(--color-cream-50)] p-5 text-[var(--color-ink-900)] shadow-[0_18px_55px_rgba(44,29,20,0.12)] sm:p-7">
      <p
        aria-hidden="true"
        className="text-2xl text-[var(--color-prague-red-600)]"
      >
        {birthdayEmojiSymbol(message.emojiKey) ?? "✦"}
      </p>
      {message.title ? (
        <h3 className="font-display mt-3 text-3xl font-semibold">
          {message.title}
        </h3>
      ) : null}
      <p className="mt-4 whitespace-pre-wrap text-base leading-7">
        {message.message}
      </p>
      <p className="mt-6 border-t border-[var(--color-ink-900)]/10 pt-4 text-xs font-bold tracking-wide uppercase">
        {message.displayMode === "anonymous"
          ? "Will appear as Anonymous"
          : "Will appear with your participant profile"}
      </p>
    </article>
  );
}

export function BirthdayVaultSection() {
  const firebase = useFirebase();
  const participants = useParticipants();
  const vault = useBirthdayVault();
  const [editing, setEditing] = useState(false);
  const [withdrawing, setWithdrawing] = useState(false);
  const [withdrawError, setWithdrawError] = useState<string | null>(null);
  const [presentationOpen, setPresentationOpen] = useState(false);
  const [seenRevealRevision, setSeenRevealRevision] = useState(
    readSeenRevealRevision,
  );

  function dismissAnnouncement() {
    const revision = vault.publicState?.revealRevision ?? 0;
    rememberRevealRevision(revision);
    setSeenRevealRevision(revision);
  }

  const collecting = vault.publicState?.status === "collecting";
  const revealed = vault.publicState?.status === "revealed";
  const announcementVisible =
    revealed && (vault.publicState?.revealRevision ?? 0) > seenRevealRevision;
  const submitted = vault.ownMessage?.status === "submitted";

  return (
    <SectionShell
      className="birthday-section"
      id="birthday"
      labelledBy="birthday-title"
      tone="cream"
    >
      <SectionHeading
        description="A private digital guestbook for notes gathered quietly, reviewed with care, and shared together when the vault opens."
        eyebrow="A small celebration chapter"
        id="birthday-title"
        title="Birthday Vault"
      />

      <Reveal className="mt-9">
        <div className="birthday-vault-shell relative overflow-hidden rounded-[2rem] border border-[var(--color-antique-gold-400)]/45 bg-[var(--color-cream-50)] p-5 shadow-[0_26px_90px_rgba(66,39,25,0.12)] sm:p-8 lg:p-10">
          <div aria-hidden="true" className="birthday-wax-seal">
            <Mail size={24} />
          </div>
          <div className="relative z-10 flex flex-wrap items-start justify-between gap-5 pr-0 sm:pr-20">
            <div className="max-w-2xl">
              <StatusBadge
                tone={revealed ? "live" : collecting ? "gold" : "neutral"}
              >
                {!vault.publicState
                  ? "Not opened yet"
                  : revealed
                    ? "Vault open"
                    : collecting
                      ? "Collecting messages"
                      : "Submissions sealed"}
              </StatusBadge>
              <h3 className="font-display mt-5 text-4xl leading-tight font-semibold text-[var(--color-ink-900)] sm:text-5xl">
                {revealed ? "The guestbook is open" : "A note worth keeping"}
              </h3>
              <p className="mt-4 max-w-xl text-base leading-7 text-[var(--color-ink-600)]">
                Messages are protected by account access and Firebase database
                rules before publication. This is private application data, not
                a claim of cryptographic secrecy.
              </p>
            </div>
            <div className="min-w-36 rounded-2xl border border-[var(--color-ink-900)]/10 bg-white/60 px-5 py-4 text-center">
              <p className="font-score text-4xl font-extrabold text-[var(--color-prague-red-700)]">
                {revealed ? vault.publishedMessages.length : vault.publicCount}
              </p>
              <p className="mt-1 text-xs font-bold tracking-wide text-[var(--color-ink-600)] uppercase">
                {revealed ? "published notes" : "sealed notes"}
              </p>
            </div>
          </div>

          {firebase.status !== "ready" ? (
            <div className="relative z-10 mt-8 rounded-2xl border border-dashed border-[var(--color-ink-900)]/18 bg-white/45 p-6">
              <p className="flex items-center gap-2 font-bold text-[var(--color-ink-900)]">
                <LockKeyhole aria-hidden="true" size={18} /> Live guestbook
                unavailable
              </p>
              <p className="mt-2 text-sm leading-6 text-[var(--color-ink-600)]">
                The static trip page still works. Birthday Vault account access
                will return when Firebase is configured and available.
              </p>
            </div>
          ) : vault.state === "loading" ? (
            <p
              className="relative z-10 mt-8 text-sm text-[var(--color-ink-600)]"
              role="status"
            >
              Checking the Birthday Vault…
            </p>
          ) : vault.errorMessage ? (
            <p
              className="relative z-10 mt-8 rounded-2xl bg-[var(--color-prague-red-600)]/8 p-4 text-sm text-[var(--color-prague-red-700)]"
              role="alert"
            >
              {vault.errorMessage}
            </p>
          ) : !participants.ownParticipant ? (
            <div className="relative z-10 mt-8 rounded-2xl border border-[var(--color-ink-900)]/12 bg-white/55 p-5 sm:p-6">
              <p className="flex items-center gap-2 font-bold text-[var(--color-ink-900)]">
                <BookHeart aria-hidden="true" size={19} /> Join the roster first
              </p>
              <p className="mt-2 max-w-xl text-sm leading-6 text-[var(--color-ink-600)]">
                Your participant profile links one private message to your
                signed-in guest identity. Organizer-added profiles without an
                owner cannot submit.
              </p>
              <Button className="mt-4" href="#games">
                Go to participant onboarding
              </Button>
            </div>
          ) : null}

          {participants.ownParticipant && collecting && editing ? (
            <div className="relative z-10 mt-9 border-t border-[var(--color-ink-900)]/10 pt-8">
              <BirthdayMessageForm
                current={vault.ownMessage}
                disabled={!vault.canGuestMutate}
                onCancel={() => setEditing(false)}
                onSubmit={async (input) => {
                  await vault.submit(input);
                  setEditing(false);
                }}
              />
            </div>
          ) : participants.ownParticipant && submitted ? (
            <div className="relative z-10 mt-9 grid gap-5 border-t border-[var(--color-ink-900)]/10 pt-8 lg:grid-cols-[0.72fr_1.2fr]">
              <div className="rounded-2xl border border-[var(--color-prague-red-600)]/15 bg-[var(--color-prague-red-600)]/6 p-5">
                <p className="flex items-center gap-2 font-bold text-[var(--color-ink-900)]">
                  <ShieldCheck aria-hidden="true" size={19} /> Your message is
                  sealed
                </p>
                <p className="mt-3 text-sm leading-6 text-[var(--color-ink-600)]">
                  Only you and authorized organizers can read this private
                  version. Revision {vault.ownMessage!.revision}; any edit needs
                  fresh organizer approval.
                </p>
                {collecting ? (
                  <div className="mt-5 flex flex-wrap gap-3">
                    <Button
                      disabled={!vault.canGuestMutate}
                      onClick={() => setEditing(true)}
                    >
                      <PenLine aria-hidden="true" size={17} /> Edit message
                    </Button>
                    <Button
                      disabled={!vault.canGuestMutate || withdrawing}
                      onClick={() => {
                        setWithdrawError(null);
                        setWithdrawing(true);
                        void vault
                          .withdraw()
                          .catch((error: unknown) =>
                            setWithdrawError(
                              error instanceof Error
                                ? error.message
                                : "The message could not be withdrawn.",
                            ),
                          )
                          .finally(() => setWithdrawing(false));
                      }}
                      variant="secondary"
                    >
                      {withdrawing ? "Withdrawing…" : "Withdraw"}
                    </Button>
                  </div>
                ) : (
                  <p className="mt-4 flex items-start gap-2 text-sm font-bold text-[var(--color-prague-red-700)]">
                    <LockKeyhole
                      aria-hidden="true"
                      className="mt-0.5"
                      size={16}
                    />{" "}
                    Editing is closed. Your private copy remains available here.
                  </p>
                )}
                {withdrawError ? (
                  <p
                    className="mt-4 text-sm text-[var(--color-prague-red-700)]"
                    role="alert"
                  >
                    {withdrawError}
                  </p>
                ) : null}
              </div>
              <OwnerMessageCard message={vault.ownMessage!} />
            </div>
          ) : participants.ownParticipant && collecting ? (
            <div className="relative z-10 mt-8 flex flex-wrap items-center justify-between gap-5 rounded-2xl border border-[var(--color-ink-900)]/12 bg-white/55 p-5 sm:p-6">
              <div className="max-w-xl">
                <p className="font-bold text-[var(--color-ink-900)]">
                  {vault.ownMessage?.status === "withdrawn"
                    ? "Your earlier note is withdrawn"
                    : "Your envelope is empty"}
                </p>
                <p className="mt-2 text-sm leading-6 text-[var(--color-ink-600)]">
                  Choose a named or anonymous public display. Other guests see
                  only the total count before the reveal.
                </p>
              </div>
              <Button
                disabled={!vault.canGuestMutate}
                onClick={() => setEditing(true)}
              >
                <PenLine aria-hidden="true" size={17} /> Write your message
              </Button>
            </div>
          ) : participants.ownParticipant &&
            vault.publicState?.status === "closed" &&
            !submitted ? (
            <p className="relative z-10 mt-8 rounded-2xl border border-[var(--color-ink-900)]/12 bg-white/45 p-5 text-sm leading-6 text-[var(--color-ink-600)]">
              <LockKeyhole
                aria-hidden="true"
                className="mr-2 inline"
                size={16}
              />
              The vault is sealed and the reveal is pending. No new message can
              be added now.
            </p>
          ) : null}
        </div>
      </Reveal>

      <AnimatePresence>
        {revealed && announcementVisible ? (
          <motion.div
            animate={{ opacity: 1, y: 0 }}
            className="mt-8 flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-[var(--color-prague-red-700)] p-5 text-white shadow-lg"
            initial={{ opacity: 0, y: 12 }}
            role="status"
          >
            <div>
              <p className="flex items-center gap-2 font-bold">
                <Sparkles aria-hidden="true" size={19} /> The Birthday Vault is
                open
              </p>
              <p className="mt-1 text-sm text-white/75">
                {vault.publishedMessages.length} messages are ready to view.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                onClick={() => {
                  dismissAnnouncement();
                  setPresentationOpen(true);
                }}
                variant="inverse"
              >
                View reveal
              </Button>
              <Button
                className="text-white"
                onClick={dismissAnnouncement}
                variant="quiet"
              >
                Not now
              </Button>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      {revealed ? (
        <div className="mt-12">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs font-bold tracking-[0.18em] text-[var(--color-prague-red-700)] uppercase">
                Published guestbook
              </p>
              <h3 className="font-display mt-2 text-4xl font-semibold text-[var(--color-ink-900)]">
                Messages from the weekend
              </h3>
            </div>
            <Button
              disabled={vault.publishedMessages.length === 0}
              onClick={() => setPresentationOpen(true)}
            >
              Replay presentation
            </Button>
          </div>
          {vault.publishedMessages.length === 0 ? (
            <p className="mt-6 rounded-2xl border border-dashed border-[var(--color-ink-900)]/18 p-6 text-sm text-[var(--color-ink-600)]">
              Published messages are being verified.
            </p>
          ) : (
            <div className="mt-7 grid gap-5 md:grid-cols-2">
              {vault.publishedMessages.map((message) => (
                <article
                  className="birthday-message-card rounded-3xl border border-[var(--color-antique-gold-400)]/40 bg-[var(--color-cream-50)] p-6 text-[var(--color-ink-900)] shadow-[0_18px_55px_rgba(44,29,20,0.09)]"
                  key={message.id}
                >
                  <p
                    aria-hidden="true"
                    className="text-2xl text-[var(--color-prague-red-600)]"
                  >
                    {birthdayEmojiSymbol(message.emojiKey) ?? "✦"}
                  </p>
                  {message.title ? (
                    <h4 className="font-display mt-3 text-3xl font-semibold">
                      {message.title}
                    </h4>
                  ) : null}
                  <p className="mt-4 whitespace-pre-wrap text-base leading-7">
                    {message.message}
                  </p>
                  <p className="mt-6 border-t border-[var(--color-ink-900)]/10 pt-4 text-sm font-bold">
                    {message.author.displayName}
                  </p>
                  {message.author.mode === "anonymous" ? (
                    <p className="mt-1 text-xs text-[var(--color-ink-600)]">
                      Shared anonymously
                    </p>
                  ) : null}
                </article>
              ))}
            </div>
          )}
        </div>
      ) : null}

      {presentationOpen ? (
        <Suspense
          fallback={
            <p className="sr-only" role="status">
              Opening Birthday Vault presentation…
            </p>
          }
        >
          <BirthdayVaultPresentation
            label="Birthday Vault"
            messages={vault.publishedMessages}
            onClose={() => setPresentationOpen(false)}
          />
        </Suspense>
      ) : null}
    </SectionShell>
  );
}

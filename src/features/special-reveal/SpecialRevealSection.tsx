import { useState } from "react";
import {
  Check,
  Eye,
  LockKeyhole,
  ShieldQuestion,
  Sparkles,
  Undo2,
} from "lucide-react";
import { Reveal } from "../../components/feedback/Reveal";
import { SectionShell } from "../../components/layout/SectionShell";
import { Button } from "../../components/ui/Button";
import { LockedContentCard } from "../../components/ui/LockedContentCard";
import { SectionHeading } from "../../components/ui/SectionHeading";
import { StatusBadge } from "../../components/ui/StatusBadge";
import { specialRevealState } from "../../data/lockedStates";
import { friendlyFirebaseError } from "../../lib/firebase/errors";
import type { PredictionOption } from "./domain/types";
import { SpecialRevealPresentation } from "./presentation/SpecialRevealPresentation";
import { useSpecialReveal } from "./SpecialRevealProvider";

function safeStorageKey(kind: "open" | "resolved", revision: number) {
  return `games-and-castles:special-reveal:${kind}:${revision}`;
}

function RevisionAnnouncement({
  kind,
  revision,
}: {
  kind: "open" | "resolved";
  revision: number;
}) {
  const [announcement] = useState(() => {
    const key = safeStorageKey(kind, revision);
    if (window.localStorage.getItem(key)) return "";
    window.localStorage.setItem(key, "seen");
    return kind === "resolved"
      ? "The special reveal has been resolved."
      : "Predictions are now open.";
  });
  return (
    <p aria-live="polite" className="sr-only">
      {announcement}
    </p>
  );
}

export function SpecialRevealSection() {
  const reveal = useSpecialReveal();
  const opening = reveal.opening;
  const [selection, setSelection] = useState<PredictionOption | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [presentationOpen, setPresentationOpen] = useState(false);

  const submitted = reveal.ownPrediction?.status === "submitted";
  const selected =
    selection ?? (submitted ? (reveal.ownPrediction?.selection ?? null) : null);
  const resolved = reveal.publicState?.status === "resolved";
  const correct =
    resolved && submitted && reveal.resolution
      ? reveal.ownPrediction?.selection === reveal.resolution.correctOption
      : null;

  async function submit() {
    if (!selected || submitting) return;
    setSubmitting(true);
    setMessage(null);
    try {
      await reveal.submitPrediction(selected);
      setMessage("Your private prediction is saved.");
    } catch (error) {
      setMessage(
        friendlyFirebaseError(
          error,
          error instanceof Error
            ? error.message
            : "The prediction could not be saved.",
        ),
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function withdraw() {
    if (submitting) return;
    setSubmitting(true);
    setMessage(null);
    try {
      await reveal.withdrawPrediction();
      setSelection(null);
      setMessage("Your prediction was withdrawn.");
    } catch (error) {
      setMessage(
        friendlyFirebaseError(
          error,
          error instanceof Error
            ? error.message
            : "The prediction could not be withdrawn.",
        ),
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <SectionShell
      className="special-reveal-section"
      id="reveal"
      labelledBy="reveal-title"
      tone="locked"
    >
      <SectionHeading
        description="A protected weekend moment and one private prediction, published only through the trusted backend."
        eyebrow="Protected moment"
        id="reveal-title"
        title={
          resolved ? "The lock is open" : "Something waits beyond the lock"
        }
        tone="dark"
      />
      {reveal.publicState ? (
        <RevisionAnnouncement
          key={`${reveal.publicState.status}:${reveal.publicState.revision}`}
          kind={reveal.publicState.status === "resolved" ? "resolved" : "open"}
          revision={
            reveal.publicState.status === "resolved"
              ? reveal.publicState.resolutionRevision
              : reveal.publicState.openRevision
          }
        />
      ) : null}

      <Reveal className="mt-9">
        {!reveal.publicState || !opening ? (
          <LockedContentCard state={specialRevealState}>
            <div className="border-t border-white/8 pt-6">
              <p className="flex items-center gap-2 text-sm text-white/60">
                <LockKeyhole aria-hidden="true" size={18} />
                No prediction labels or reveal content are available before
                opening.
              </p>
            </div>
          </LockedContentCard>
        ) : (
          <div className="special-reveal-panel rounded-[var(--radius-xl)] border border-white/12 bg-[var(--color-night-800)] p-5 sm:p-8">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <StatusBadge
                  tone={
                    resolved
                      ? "success"
                      : reveal.publicState.status === "prediction-open"
                        ? "live"
                        : "gold"
                  }
                >
                  {resolved
                    ? "Resolved"
                    : reveal.publicState.status === "prediction-open"
                      ? "Predictions open"
                      : "Predictions locked"}
                </StatusBadge>
                <h3 className="font-display mt-4 text-3xl font-semibold text-white sm:text-4xl">
                  {resolved && reveal.resolution
                    ? reveal.resolution.title
                    : opening.title}
                </h3>
                <p className="mt-3 max-w-2xl whitespace-pre-wrap leading-7 text-white/65">
                  {resolved && reveal.resolution
                    ? reveal.resolution.body
                    : opening.body}
                </p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-right">
                <p className="text-xs font-bold tracking-wide text-white/45 uppercase">
                  Predictions
                </p>
                <p className="mt-1 text-2xl font-extrabold text-white">
                  {reveal.predictionCount}
                </p>
              </div>
            </div>

            {resolved && reveal.resolution ? (
              <div className="mt-7 grid gap-4 sm:grid-cols-2">
                <div className="rounded-2xl border border-[var(--color-antique-gold-400)]/35 bg-black/15 p-5">
                  <p className="text-xs font-bold tracking-wide text-white/45 uppercase">
                    Correct option
                  </p>
                  <p className="mt-2 text-xl font-extrabold text-white">
                    {reveal.resolution.correctOptionLabel}
                  </p>
                  <p className="mt-2 text-sm text-white/55">
                    Option A: {reveal.resolution.aggregate.optionA} · Option B:{" "}
                    {reveal.resolution.aggregate.optionB}
                  </p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-black/15 p-5">
                  <p className="flex items-center gap-2 font-bold text-white">
                    {correct === true ? (
                      <Check aria-hidden="true" size={19} />
                    ) : (
                      <ShieldQuestion aria-hidden="true" size={19} />
                    )}
                    {correct === true
                      ? `Correct · +${reveal.resolution.correctPredictionPoints} points`
                      : correct === false
                        ? "Not this time · 0 points"
                        : "No active prediction recorded"}
                  </p>
                  {submitted ? (
                    <p className="mt-2 text-sm text-white/55">
                      Your private selection was{" "}
                      {opening.optionLabels[reveal.ownPrediction!.selection]}.
                    </p>
                  ) : null}
                </div>
                <Button
                  className="sm:col-span-2 sm:justify-self-start"
                  onClick={() => setPresentationOpen(true)}
                  variant="dark"
                >
                  <Eye aria-hidden="true" size={18} />
                  Replay presentation
                </Button>
              </div>
            ) : (
              <fieldset
                className="mt-7"
                disabled={!reveal.canGuestMutate || submitting}
              >
                <legend className="text-lg font-extrabold text-white">
                  {opening.predictionPrompt}
                </legend>
                <p className="mt-1 text-sm text-white/50">
                  Only you can read your selection before resolution. The public
                  count contains no identity or choice.
                </p>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  {(["option-a", "option-b"] as const).map((option) => (
                    <label
                      className={`flex min-h-16 cursor-pointer items-center gap-3 rounded-2xl border p-4 text-sm font-bold transition ${selected === option ? "border-[var(--color-electric-cyan-400)] bg-[var(--color-electric-cyan-400)]/10 text-white" : "border-white/12 bg-white/[0.025] text-white/65"}`}
                      key={option}
                    >
                      <input
                        checked={selected === option}
                        className="size-5 accent-[var(--color-electric-cyan-400)]"
                        name="prediction"
                        onChange={() => setSelection(option)}
                        type="radio"
                        value={option}
                      />
                      {opening.optionLabels[option]}
                    </label>
                  ))}
                </div>
                <div className="mt-5 flex flex-wrap gap-3">
                  <Button
                    disabled={!selected || !reveal.canGuestMutate || submitting}
                    onClick={() => void submit()}
                    variant="dark"
                  >
                    <Sparkles aria-hidden="true" size={17} />
                    {submitted ? "Update prediction" : "Save prediction"}
                  </Button>
                  {submitted ? (
                    <Button
                      disabled={!reveal.canGuestMutate || submitting}
                      onClick={() => void withdraw()}
                      variant="quiet"
                    >
                      <Undo2 aria-hidden="true" size={17} />
                      Withdraw
                    </Button>
                  ) : null}
                </div>
              </fieldset>
            )}

            {reveal.publicState.status === "prediction-locked" ? (
              <p className="mt-6 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/60">
                Predictions are locked. Your saved selection remains private
                while the organizer prepares the resolution.
              </p>
            ) : null}
            {message || reveal.errorMessage ? (
              <p className="mt-4 text-sm text-white/65" role="status">
                {message ?? reveal.errorMessage}
              </p>
            ) : null}
          </div>
        )}
      </Reveal>

      {presentationOpen && opening && reveal.resolution ? (
        <SpecialRevealPresentation
          onClose={() => setPresentationOpen(false)}
          opening={opening}
          resolution={reveal.resolution}
        />
      ) : null}
    </SectionShell>
  );
}

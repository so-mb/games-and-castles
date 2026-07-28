import { useMemo, useState } from "react";
import {
  Eye,
  Lock,
  RefreshCw,
  Save,
  ShieldCheck,
  Sparkles,
  Unlock,
} from "lucide-react";
import { Button } from "../../../components/ui/Button";
import { StatusBadge } from "../../../components/ui/StatusBadge";
import { friendlyFirebaseError } from "../../../lib/firebase/errors";
import { useAuth } from "../../auth/AuthProvider";
import type { RecentRevealAuthorization } from "../../auth/specialRevealAuthorization";
import { useConnection } from "../../live/ConnectionProvider";
import type {
  PredictionOption,
  RevealEmojiKey,
  SpecialRevealConfigInput,
} from "../domain/types";
import { revealEmojiKeys } from "../domain/types";
import { validateSpecialRevealConfig } from "../domain/validation";
import { useSpecialReveal } from "../SpecialRevealProvider";
import { SensitiveActionDialog } from "./SensitiveActionDialog";
import { SpecialRevealRehearsal } from "./SpecialRevealRehearsal";

const emptyConfig: SpecialRevealConfigInput = {
  eventId: "weekend-event",
  opening: {
    title: "A special announcement is ready.",
    body: "Make one private prediction before the event is locked.",
    emojiKey: "sparkles",
  },
  predictionPrompt: "Which option do you predict?",
  optionLabels: { "option-a": "Option A", "option-b": "Option B" },
  resolutionPayloads: {
    "option-a": {
      title: "Option A resolution",
      body: "The selected resolution presentation appears here.",
      emojiKey: "star",
    },
    "option-b": {
      title: "Option B resolution",
      body: "The selected resolution presentation appears here.",
      emojiKey: "star",
    },
  },
  correctPredictionPoints: 3,
};

function payloadFields(
  label: string,
  value: SpecialRevealConfigInput["opening"],
  onChange: (value: SpecialRevealConfigInput["opening"]) => void,
  disabled: boolean,
) {
  return (
    <fieldset
      className="rounded-2xl border border-white/10 p-4"
      disabled={disabled}
    >
      <legend className="px-2 text-sm font-extrabold text-white">
        {label}
      </legend>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="text-sm font-bold">
          Title
          <input
            className="mt-2 min-h-11 w-full rounded-xl border border-white/15 bg-white/5 px-3"
            maxLength={100}
            onChange={(event) =>
              onChange({ ...value, title: event.target.value })
            }
            value={value.title}
          />
        </label>
        <label className="text-sm font-bold">
          Motif
          <select
            className="mt-2 min-h-11 w-full rounded-xl border border-white/15 bg-[var(--color-night-900)] px-3"
            onChange={(event) =>
              onChange({
                ...value,
                emojiKey: event.target.value as RevealEmojiKey,
              })
            }
            value={value.emojiKey}
          >
            {revealEmojiKeys.map((key) => (
              <option key={key}>{key}</option>
            ))}
          </select>
        </label>
      </div>
      <label className="mt-4 block text-sm font-bold">
        Body
        <textarea
          className="mt-2 min-h-28 w-full rounded-xl border border-white/15 bg-white/5 p-3"
          maxLength={1500}
          onChange={(event) => onChange({ ...value, body: event.target.value })}
          value={value.body}
        />
      </label>
    </fieldset>
  );
}

function SpecialRevealWorkspaceEditor({
  initialConfig,
}: {
  initialConfig: SpecialRevealConfigInput;
}) {
  const reveal = useSpecialReveal();
  const auth = useAuth();
  const connection = useConnection();
  const [config, setConfig] = useState<SpecialRevealConfigInput>(initialConfig);
  const [correctOption, setCorrectOption] =
    useState<PredictionOption>("option-a");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [rehearsalOpen, setRehearsalOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<{
    title: string;
    consequence: string;
    confirmationPhrase: string;
    success: string;
    execute: (authorization: RecentRevealAuthorization) => Promise<void>;
  } | null>(null);

  const validation = useMemo(
    () => validateSpecialRevealConfig(config),
    [config],
  );
  const frozen = reveal.publicState !== null;

  async function saveConfiguration() {
    if (busy) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      await reveal.saveConfig(config);
      setMessage("Configuration saved.");
    } catch (cause) {
      setError(
        friendlyFirebaseError(
          cause,
          cause instanceof Error
            ? cause.message
            : "The operation was not accepted.",
        ),
      );
    } finally {
      setBusy(false);
    }
  }

  function requestSensitiveAction(action: NonNullable<typeof pendingAction>) {
    if (!reveal.canOrganizerMutate) return;
    setError(null);
    setMessage(null);
    setPendingAction(action);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <StatusBadge
            tone={
              reveal.publicState?.status === "resolved"
                ? "success"
                : reveal.publicState?.status === "prediction-open"
                  ? "live"
                  : "gold"
            }
          >
            {reveal.publicState?.status ?? "Not opened"}
          </StatusBadge>
          <p className="mt-2 text-sm text-white/50">
            {reveal.predictionCount} active predictions · state r
            {reveal.publicState?.revision ?? 0} · resolution r
            {reveal.publicState?.resolutionRevision ?? 0}
          </p>
        </div>
        <Button onClick={() => setRehearsalOpen(true)} variant="quiet">
          <Eye aria-hidden="true" size={17} />
          Private rehearsal
        </Button>
      </div>

      <section aria-labelledby="reveal-config-title" className="space-y-4">
        <div>
          <h3 className="text-xl font-extrabold" id="reveal-config-title">
            Protected event configuration
          </h3>
          <p className="mt-1 text-sm text-white/50">
            Both resolution variants stay restricted to the dedicated reveal
            organizer until one is published. Configuration freezes after
            opening.
          </p>
        </div>
        <fieldset
          className="grid gap-4 sm:grid-cols-2"
          disabled={frozen || busy}
        >
          <label className="text-sm font-bold">
            Opaque event ID
            <input
              className="mt-2 min-h-11 w-full rounded-xl border border-white/15 bg-white/5 px-3"
              maxLength={80}
              onChange={(event) =>
                setConfig((current) => ({
                  ...current,
                  eventId: event.target.value,
                }))
              }
              value={config.eventId}
            />
          </label>
          <label className="text-sm font-bold">
            Correct prediction points
            <input
              className="mt-2 min-h-11 w-full rounded-xl border border-white/15 bg-white/5 px-3"
              max={100}
              min={1}
              onChange={(event) =>
                setConfig((current) => ({
                  ...current,
                  correctPredictionPoints: Number(event.target.value),
                }))
              }
              type="number"
              value={config.correctPredictionPoints}
            />
          </label>
        </fieldset>
        {payloadFields(
          "Opening",
          config.opening,
          (opening) => setConfig((current) => ({ ...current, opening })),
          frozen || busy,
        )}
        <fieldset
          className="rounded-2xl border border-white/10 p-4"
          disabled={frozen || busy}
        >
          <legend className="px-2 text-sm font-extrabold">Prediction</legend>
          <label className="block text-sm font-bold">
            Prompt
            <input
              className="mt-2 min-h-11 w-full rounded-xl border border-white/15 bg-white/5 px-3"
              maxLength={180}
              onChange={(event) =>
                setConfig((current) => ({
                  ...current,
                  predictionPrompt: event.target.value,
                }))
              }
              value={config.predictionPrompt}
            />
          </label>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {(["option-a", "option-b"] as const).map((option) => (
              <label className="text-sm font-bold" key={option}>
                {option} label
                <input
                  className="mt-2 min-h-11 w-full rounded-xl border border-white/15 bg-white/5 px-3"
                  maxLength={50}
                  onChange={(event) =>
                    setConfig((current) => ({
                      ...current,
                      optionLabels: {
                        ...current.optionLabels,
                        [option]: event.target.value,
                      },
                    }))
                  }
                  value={config.optionLabels[option]}
                />
              </label>
            ))}
          </div>
        </fieldset>
        {payloadFields(
          "Option A resolution",
          config.resolutionPayloads["option-a"],
          (value) =>
            setConfig((current) => ({
              ...current,
              resolutionPayloads: {
                ...current.resolutionPayloads,
                "option-a": value,
              },
            })),
          frozen || busy,
        )}
        {payloadFields(
          "Option B resolution",
          config.resolutionPayloads["option-b"],
          (value) =>
            setConfig((current) => ({
              ...current,
              resolutionPayloads: {
                ...current.resolutionPayloads,
                "option-b": value,
              },
            })),
          frozen || busy,
        )}
        {!validation.valid ? (
          <ul className="list-disc space-y-1 pl-5 text-sm text-[#ffc3c6]">
            {validation.errors.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        ) : null}
        <Button
          disabled={
            frozen || busy || !validation.valid || !reveal.canOrganizerMutate
          }
          onClick={() => void saveConfiguration()}
          variant="dark"
        >
          <Save aria-hidden="true" size={17} />
          Save configuration
        </Button>
      </section>

      <section
        aria-labelledby="reveal-controls-title"
        className="rounded-[var(--radius-xl)] border border-white/10 bg-black/15 p-5"
      >
        <h3 className="text-xl font-extrabold" id="reveal-controls-title">
          Lifecycle controls
        </h3>
        <p className="mt-1 text-sm text-white/50">
          Every lifecycle action requires the current Firebase organizer
          password, both custom claims, and a recent authentication token.
          Publication is one atomic Realtime Database update.
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          {!reveal.publicState ? (
            <Button
              disabled={
                busy || !reveal.privateConfig || !reveal.canOrganizerMutate
              }
              onClick={() =>
                requestSensitiveAction({
                  title: "Open the special reveal",
                  consequence:
                    "Publishes the reviewed opening and prediction labels to every signed-in guest, then opens predictions.",
                  confirmationPhrase: "OPEN REVEAL",
                  success: "Predictions opened.",
                  execute: reveal.open,
                })
              }
              variant="dark"
            >
              <Unlock aria-hidden="true" size={17} />
              Open predictions
            </Button>
          ) : reveal.publicState.status === "prediction-open" ? (
            <Button
              disabled={busy || !reveal.canOrganizerMutate}
              onClick={() =>
                requestSensitiveAction({
                  title: "Lock predictions",
                  consequence:
                    "Stops every guest from editing or withdrawing a prediction until you deliberately reopen.",
                  confirmationPhrase: "LOCK PREDICTIONS",
                  success: "Predictions locked.",
                  execute: reveal.lock,
                })
              }
              variant="dark"
            >
              <Lock aria-hidden="true" size={17} />
              Lock predictions
            </Button>
          ) : reveal.publicState.status === "prediction-locked" ? (
            <>
              <Button
                disabled={busy || !reveal.canOrganizerMutate}
                onClick={() =>
                  requestSensitiveAction({
                    title: "Reopen predictions",
                    consequence:
                      "Allows guests to edit or withdraw their existing predictions again.",
                    confirmationPhrase: "REOPEN PREDICTIONS",
                    success: "Predictions reopened.",
                    execute: reveal.reopen,
                  })
                }
                variant="quiet"
              >
                <Unlock aria-hidden="true" size={17} />
                Reopen predictions
              </Button>
              <select
                aria-label="Correct prediction option"
                className="min-h-11 rounded-xl border border-white/15 bg-[var(--color-night-900)] px-3"
                onChange={(event) =>
                  setCorrectOption(event.target.value as PredictionOption)
                }
                value={correctOption}
              >
                <option value="option-a">Option A</option>
                <option value="option-b">Option B</option>
              </select>
              <Button
                disabled={busy || !reveal.canOrganizerMutate}
                onClick={() =>
                  requestSensitiveAction({
                    title: "Resolve and publish",
                    consequence:
                      "Publishes only the selected resolution, freezes predictions permanently, and replaces the complete prediction scoring source.",
                    confirmationPhrase: "RESOLVE PREDICTIONS",
                    success: "Reveal resolved and scoring published.",
                    execute: (authorization) =>
                      reveal.resolve(authorization, correctOption),
                  })
                }
                variant="dark"
              >
                <Sparkles aria-hidden="true" size={17} />
                Resolve and publish
              </Button>
            </>
          ) : (
            <Button
              disabled={busy || !reveal.canOrganizerMutate}
              onClick={() =>
                requestSensitiveAction({
                  title: "Reconcile prediction scoring",
                  consequence:
                    "Recalculates the complete prediction source from the resolved event without changing the published outcome.",
                  confirmationPhrase: "RECONCILE LEDGER",
                  success: "Prediction ledger reconciled.",
                  execute: reveal.reconcile,
                })
              }
              variant="quiet"
            >
              <RefreshCw aria-hidden="true" size={17} />
              Reconcile prediction ledger
            </Button>
          )}
        </div>
        {reveal.publicState?.status === "resolved" ? (
          <div className="mt-6 rounded-2xl border border-[#ff9ca1]/25 p-4">
            <p className="flex items-center gap-2 font-extrabold text-[#ffc3c6]">
              <ShieldCheck aria-hidden="true" size={18} />
              Correct a published resolution
            </p>
            <p className="mt-1 text-sm text-white/50">
              Predictions remain locked. This replaces the selected payload and
              complete ledger source.
            </p>
            <div className="mt-4 max-w-sm">
              <select
                aria-label="Corrected prediction option"
                className="min-h-11 rounded-xl border border-white/15 bg-[var(--color-night-900)] px-3"
                onChange={(event) =>
                  setCorrectOption(event.target.value as PredictionOption)
                }
                value={correctOption}
              >
                <option value="option-a">Option A</option>
                <option value="option-b">Option B</option>
              </select>
            </div>
            <Button
              className="mt-3"
              disabled={busy || !reveal.canOrganizerMutate}
              onClick={() =>
                requestSensitiveAction({
                  title: "Correct the published result",
                  consequence:
                    "Replaces the public resolution and complete prediction source. Previous winners lose those points and newly correct predictors receive them.",
                  confirmationPhrase: "CORRECT RESULT",
                  success: "Published resolution corrected and rescored.",
                  execute: (authorization) =>
                    reveal.correct(authorization, correctOption),
                })
              }
              variant="quiet"
            >
              <ShieldCheck aria-hidden="true" size={17} />
              Correct result
            </Button>
          </div>
        ) : null}
        {message ? (
          <p
            className="mt-4 text-sm text-[var(--color-success-500)]"
            role="status"
          >
            {message}
          </p>
        ) : null}
        {error ? (
          <p
            className="mt-4 rounded-xl border border-[#ff9ca1]/30 bg-[#ff9ca1]/8 px-4 py-3 text-sm text-[#ffc3c6]"
            role="alert"
          >
            {error}
          </p>
        ) : null}
      </section>
      <SpecialRevealRehearsal
        config={config}
        onClose={() => setRehearsalOpen(false)}
        open={rehearsalOpen}
      />
      <SensitiveActionDialog
        confirmationPhrase={pendingAction?.confirmationPhrase ?? "CONFIRM"}
        consequence={pendingAction?.consequence ?? ""}
        key={pendingAction?.title ?? "closed"}
        onCancel={() => setPendingAction(null)}
        onExecute={async (authorization) => {
          if (!pendingAction) return;
          await pendingAction.execute(authorization);
        }}
        onReauthenticate={auth.reauthenticateSpecialReveal}
        onSuccess={() => {
          if (pendingAction) setMessage(pendingAction.success);
        }}
        online={connection === "online"}
        open={pendingAction !== null}
        organizerEmail={
          auth.organizer.status === "authorized" ? auth.organizer.email : ""
        }
        title={pendingAction?.title ?? "Confirm protected action"}
      />
    </div>
  );
}

export function SpecialRevealWorkspace() {
  const reveal = useSpecialReveal();
  const config = reveal.privateConfig
    ? {
        eventId: reveal.privateConfig.eventId,
        opening: reveal.privateConfig.opening,
        predictionPrompt: reveal.privateConfig.predictionPrompt,
        optionLabels: reveal.privateConfig.optionLabels,
        resolutionPayloads: reveal.privateConfig.resolutionPayloads,
        correctPredictionPoints: reveal.privateConfig.correctPredictionPoints,
      }
    : emptyConfig;
  return (
    <SpecialRevealWorkspaceEditor
      initialConfig={config}
      key={reveal.privateConfig?.revision ?? "new"}
    />
  );
}

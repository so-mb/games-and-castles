import { useId, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "../../components/ui/Button";
import { ContentIcon } from "../../components/ui/ContentIcon";
import { cn } from "../../lib/cn";
import {
  hasDuplicateDisplayName,
  validateDisplayName,
} from "../../lib/firebase/participants";
import {
  participantIcons,
  participantTones,
  type Participant,
  type ParticipantInput,
} from "./types";

interface ParticipantFormProps {
  initialValue?: ParticipantInput;
  participants: Participant[];
  excludedParticipantId?: string;
  submitLabel: string;
  disabled?: boolean;
  onCancel?: () => void;
  onSubmit: (input: ParticipantInput) => Promise<void>;
}

const defaultValue: ParticipantInput = {
  displayName: "",
  avatar: { icon: "castle", tone: "cyan" },
};

const toneLabels = {
  cyan: "Electric cyan",
  gold: "Antique gold",
  red: "Prague red",
  neutral: "Slate",
};

export function ParticipantForm({
  initialValue = defaultValue,
  participants,
  excludedParticipantId,
  submitLabel,
  disabled = false,
  onCancel,
  onSubmit,
}: ParticipantFormProps) {
  const nameId = useId();
  const [value, setValue] = useState<ParticipantInput>(initialValue);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const validationError = validateDisplayName(value.displayName);
  const duplicate =
    !validationError &&
    hasDuplicateDisplayName(
      value.displayName,
      participants,
      excludedParticipantId,
    );

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (validationError || submitting || disabled) return;
    setSubmitting(true);
    setError(null);
    try {
      await onSubmit(value);
    } catch (submissionError) {
      setError(
        submissionError instanceof Error
          ? submissionError.message
          : "The participant could not be saved.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="space-y-6" onSubmit={handleSubmit}>
      <div>
        <label className="text-sm font-bold" htmlFor={nameId}>
          Display name
        </label>
        <input
          aria-describedby={`${nameId}-hint`}
          autoComplete="nickname"
          className="mt-2 min-h-12 w-full rounded-xl border border-white/15 bg-white/7 px-4 text-base text-white outline-none transition placeholder:text-white/30 focus:border-[var(--color-electric-cyan-400)] focus:ring-3 focus:ring-[var(--color-electric-cyan-400)]/18"
          disabled={disabled || submitting}
          id={nameId}
          maxLength={24}
          minLength={2}
          onChange={(event) =>
            setValue((current) => ({
              ...current,
              displayName: event.target.value,
            }))
          }
          placeholder="Your name at the table"
          required
          value={value.displayName}
        />
        <p className="mt-2 text-xs text-white/48" id={`${nameId}-hint`}>
          2–24 characters. Similar names are allowed, but may be confusing.
        </p>
        {duplicate ? (
          <p
            className="mt-2 flex items-start gap-2 text-sm text-[var(--color-antique-gold-400)]"
            role="status"
          >
            <AlertTriangle
              aria-hidden="true"
              className="mt-0.5 shrink-0"
              size={16}
            />
            That name is already in the roster. You can still use it.
          </p>
        ) : null}
      </div>

      <fieldset>
        <legend className="text-sm font-bold">Choose an icon</legend>
        <div className="mt-3 grid grid-cols-6 gap-2">
          {participantIcons.map((icon) => (
            <button
              aria-label={`${icon} avatar`}
              aria-pressed={value.avatar.icon === icon}
              className={cn(
                "flex min-h-11 items-center justify-center rounded-xl border transition focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)]",
                value.avatar.icon === icon
                  ? "border-[var(--color-electric-cyan-400)] bg-[var(--color-electric-cyan-400)]/14 text-[var(--color-electric-cyan-400)]"
                  : "border-white/12 bg-white/5 text-white/60 hover:bg-white/9",
              )}
              disabled={disabled || submitting}
              key={icon}
              onClick={() =>
                setValue((current) => ({
                  ...current,
                  avatar: { ...current.avatar, icon },
                }))
              }
              type="button"
            >
              <ContentIcon name={icon} size={20} />
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className="text-sm font-bold">Choose a colour</legend>
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {participantTones.map((tone) => (
            <button
              aria-pressed={value.avatar.tone === tone}
              className={cn(
                "min-h-11 rounded-xl border px-3 text-xs font-bold transition focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)]",
                value.avatar.tone === tone
                  ? "border-white/60 bg-white/12 text-white"
                  : "border-white/12 bg-white/4 text-white/55 hover:bg-white/8",
              )}
              disabled={disabled || submitting}
              key={tone}
              onClick={() =>
                setValue((current) => ({
                  ...current,
                  avatar: { ...current.avatar, tone },
                }))
              }
              type="button"
            >
              {toneLabels[tone]}
            </button>
          ))}
        </div>
      </fieldset>

      {error ? (
        <p
          className="rounded-xl border border-[#ff9ca1]/30 bg-[#ff9ca1]/8 px-4 py-3 text-sm text-[#ffc3c6]"
          role="alert"
        >
          {error}
        </p>
      ) : null}

      <div className="flex flex-wrap justify-end gap-3">
        {onCancel ? (
          <Button disabled={submitting} onClick={onCancel} variant="quiet">
            Cancel
          </Button>
        ) : null}
        <Button
          disabled={disabled || submitting || Boolean(validationError)}
          type="submit"
          variant="dark"
        >
          {submitting ? "Saving…" : submitLabel}
        </Button>
      </div>
    </form>
  );
}

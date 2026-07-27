import { useId, useState } from "react";
import { Check, Eye, EyeOff } from "lucide-react";
import { Button } from "../../../components/ui/Button";
import type { BirthdayMessage, BirthdayMessageInput } from "../domain/types";
import { birthdayEmojiOptions, birthdayEmojiSymbol } from "../domain/emoji";
import { validateBirthdayMessageInput } from "../domain/validation";

interface BirthdayMessageFormProps {
  current?: BirthdayMessage | null;
  disabled: boolean;
  onCancel: () => void;
  onSubmit: (input: BirthdayMessageInput) => Promise<void>;
}

export function BirthdayMessageForm({
  current,
  disabled,
  onCancel,
  onSubmit,
}: BirthdayMessageFormProps) {
  const messageHelpId = useId();
  const [value, setValue] = useState<BirthdayMessageInput>({
    title: current?.title ?? "",
    message: current?.message ?? "",
    emojiKey: current?.emojiKey ?? null,
    displayMode: current?.displayMode ?? "named",
  });
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const validation = validateBirthdayMessageInput(value);
  const visibleErrors = submitted ? validation.errors : {};

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitted(true);
    setError(null);
    if (!validation.valid || saving) return;
    setSaving(true);
    try {
      await onSubmit(value);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Your message could not be saved.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <form
      className="grid gap-6 lg:grid-cols-[1fr_0.82fr]"
      onSubmit={handleSubmit}
    >
      <div className="space-y-5 rounded-3xl border border-[var(--color-ink-900)]/10 bg-white/55 p-4 sm:p-6">
        <label className="block text-sm font-bold text-[var(--color-ink-900)]">
          Title{" "}
          <span className="font-normal text-[var(--color-ink-600)]">
            (optional)
          </span>
          <input
            aria-describedby={
              visibleErrors.title ? `${messageHelpId}-title` : undefined
            }
            aria-invalid={Boolean(visibleErrors.title)}
            className="mt-2 min-h-12 w-full rounded-xl border border-[var(--color-ink-900)]/18 bg-white px-4 text-base font-normal outline-none focus:border-[var(--color-prague-red-600)] focus:ring-3 focus:ring-[var(--color-prague-red-600)]/15"
            disabled={disabled || saving}
            maxLength={61}
            onChange={(event) =>
              setValue((currentValue) => ({
                ...currentValue,
                title: event.target.value,
              }))
            }
            placeholder="A small heading"
            value={value.title}
          />
        </label>
        {visibleErrors.title ? (
          <p
            className="text-sm text-[var(--color-prague-red-700)]"
            id={`${messageHelpId}-title`}
            role="alert"
          >
            {visibleErrors.title}
          </p>
        ) : null}

        <label className="block text-sm font-bold text-[var(--color-ink-900)]">
          Your message
          <textarea
            aria-describedby={`${messageHelpId} ${visibleErrors.message ? `${messageHelpId}-error` : ""}`}
            aria-invalid={Boolean(visibleErrors.message)}
            className="mt-2 min-h-48 w-full resize-y rounded-xl border border-[var(--color-ink-900)]/18 bg-white px-4 py-3 text-base leading-7 font-normal outline-none focus:border-[var(--color-prague-red-600)] focus:ring-3 focus:ring-[var(--color-prague-red-600)]/15"
            disabled={disabled || saving}
            maxLength={1201}
            onChange={(event) =>
              setValue((currentValue) => ({
                ...currentValue,
                message: event.target.value,
              }))
            }
            required
            value={value.message}
          />
        </label>
        <div
          className="flex flex-wrap justify-between gap-2 text-xs text-[var(--color-ink-600)]"
          id={messageHelpId}
        >
          <span>Plain text · intentional line breaks are kept</span>
          <span aria-live="polite">{value.message.length} / 1,200</span>
        </div>
        {visibleErrors.message ? (
          <p
            className="text-sm text-[var(--color-prague-red-700)]"
            id={`${messageHelpId}-error`}
            role="alert"
          >
            {visibleErrors.message}
          </p>
        ) : null}

        <fieldset>
          <legend className="text-sm font-bold text-[var(--color-ink-900)]">
            Small motif (optional)
          </legend>
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              aria-label="No motif"
              aria-pressed={value.emojiKey === null}
              className="flex size-12 items-center justify-center rounded-xl border border-[var(--color-ink-900)]/16 bg-white text-sm font-bold aria-pressed:border-[var(--color-prague-red-600)] aria-pressed:bg-[var(--color-prague-red-600)]/8"
              disabled={disabled || saving}
              onClick={() =>
                setValue((currentValue) => ({
                  ...currentValue,
                  emojiKey: null,
                }))
              }
              type="button"
            >
              None
            </button>
            {birthdayEmojiOptions.map((option) => (
              <button
                aria-label={option.label}
                aria-pressed={value.emojiKey === option.key}
                className="flex size-12 items-center justify-center rounded-xl border border-[var(--color-ink-900)]/16 bg-white text-xl aria-pressed:border-[var(--color-prague-red-600)] aria-pressed:bg-[var(--color-prague-red-600)]/8"
                disabled={disabled || saving}
                key={option.key}
                onClick={() =>
                  setValue((currentValue) => ({
                    ...currentValue,
                    emojiKey: option.key,
                  }))
                }
                type="button"
              >
                {option.symbol}
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset>
          <legend className="text-sm font-bold text-[var(--color-ink-900)]">
            How should it appear after the reveal?
          </legend>
          <p className="mt-1 text-sm leading-6 text-[var(--color-ink-600)]">
            Named uses your participant profile snapshot. Anonymous publishes no
            participant identity.
          </p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {(["named", "anonymous"] as const).map((mode) => (
              <label
                className="flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border border-[var(--color-ink-900)]/16 bg-white px-4 text-sm font-bold text-[var(--color-ink-900)] has-checked:border-[var(--color-prague-red-600)] has-checked:bg-[var(--color-prague-red-600)]/7"
                key={mode}
              >
                <input
                  checked={value.displayMode === mode}
                  disabled={disabled || saving}
                  name="birthday-display-mode"
                  onChange={() =>
                    setValue((currentValue) => ({
                      ...currentValue,
                      displayMode: mode,
                    }))
                  }
                  type="radio"
                />
                {mode === "named" ? (
                  <Eye aria-hidden="true" size={18} />
                ) : (
                  <EyeOff aria-hidden="true" size={18} />
                )}
                {mode === "named" ? "Show my name" : "Show Anonymous"}
              </label>
            ))}
          </div>
        </fieldset>

        {error ? (
          <p
            className="rounded-xl bg-[var(--color-prague-red-600)]/10 px-4 py-3 text-sm text-[var(--color-prague-red-700)]"
            role="alert"
          >
            {error}
          </p>
        ) : null}
        <div className="flex flex-wrap gap-3">
          <Button disabled={disabled || saving} type="submit">
            <Check aria-hidden="true" size={17} />
            {saving
              ? "Sealing message…"
              : current
                ? "Save new revision"
                : "Seal my message"}
          </Button>
          <Button disabled={saving} onClick={onCancel} variant="secondary">
            Cancel
          </Button>
        </div>
      </div>

      <div className="lg:sticky lg:top-24 lg:self-start">
        <p className="mb-2 text-xs font-bold tracking-[0.16em] text-[var(--color-prague-red-700)] uppercase">
          Live preview
        </p>
        <article className="birthday-message-card min-h-72 rounded-3xl border border-[var(--color-antique-gold-400)]/45 bg-[var(--color-cream-50)] p-6 text-[var(--color-ink-900)] shadow-[0_24px_70px_rgba(44,29,20,0.13)] sm:p-8">
          <p
            className="text-3xl text-[var(--color-prague-red-600)]"
            aria-hidden="true"
          >
            {birthdayEmojiSymbol(value.emojiKey) ?? "✦"}
          </p>
          <h3 className="font-display mt-5 text-3xl font-semibold">
            {value.title.trim() || "A note for later"}
          </h3>
          <p className="mt-4 whitespace-pre-wrap text-base leading-7">
            {value.message || "Your message preview will appear here."}
          </p>
          <p className="mt-8 border-t border-[var(--color-ink-900)]/10 pt-4 text-sm font-bold">
            {value.displayMode === "anonymous"
              ? "Anonymous"
              : "Your participant name"}
          </p>
        </article>
      </div>
    </form>
  );
}

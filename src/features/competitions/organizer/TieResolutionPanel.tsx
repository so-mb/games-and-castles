import { ArrowDown, ArrowUp } from "lucide-react";
import { useState } from "react";
import { Button } from "../../../components/ui/Button";
import type { Participant } from "../../participants/types";

export function TieResolutionPanel({
  participantIds,
  participants,
  disabled,
  onConfirm,
}: {
  participantIds: string[];
  participants: Participant[];
  disabled: boolean;
  onConfirm: (orderedParticipantIds: string[], reason: string) => Promise<void>;
}) {
  const [order, setOrder] = useState(participantIds);
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const name = (id: string) =>
    participants.find((participant) => participant.id === id)?.displayName ??
    "Unavailable participant";
  const move = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= order.length) return;
    setOrder((current) => {
      const next = [...current];
      [next[index], next[target]] = [next[target]!, next[index]!];
      return next;
    });
  };
  return (
    <section
      aria-labelledby="tie-resolution-title"
      className="rounded-2xl border border-[var(--color-warning-500)]/30 bg-[var(--color-warning-500)]/8 p-5"
    >
      <h5
        className="font-extrabold text-[var(--color-warning-500)]"
        id="tie-resolution-title"
      >
        Qualification tie needs a decision
      </h5>
      <p className="mt-2 text-sm leading-6 text-white/58">
        All published metrics remain equal. Set the explicit seed order; this
        affects qualification or bracket seeding and is audited.
      </p>
      <ol className="mt-4 space-y-2">
        {order.map((participantId, index) => (
          <li
            className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/10 p-2"
            key={participantId}
          >
            <span className="w-7 text-center font-black tabular-nums">
              {index + 1}
            </span>
            <span className="min-w-0 flex-1 truncate font-bold">
              {name(participantId)}
            </span>
            <button
              aria-label={`Move ${name(participantId)} up`}
              className="flex size-11 items-center justify-center rounded-lg hover:bg-white/8 focus-visible:outline-3 focus-visible:outline-[var(--color-electric-cyan-400)] disabled:opacity-35"
              disabled={index === 0}
              onClick={() => move(index, -1)}
              type="button"
            >
              <ArrowUp aria-hidden="true" size={17} />
            </button>
            <button
              aria-label={`Move ${name(participantId)} down`}
              className="flex size-11 items-center justify-center rounded-lg hover:bg-white/8 focus-visible:outline-3 focus-visible:outline-[var(--color-electric-cyan-400)] disabled:opacity-35"
              disabled={index === order.length - 1}
              onClick={() => move(index, 1)}
              type="button"
            >
              <ArrowDown aria-hidden="true" size={17} />
            </button>
          </li>
        ))}
      </ol>
      <label className="mt-4 block text-sm font-bold" htmlFor="tie-reason">
        Optional reason
      </label>
      <input
        className="mt-2 min-h-11 w-full rounded-xl border border-white/12 bg-black/15 px-3 text-sm text-white focus-visible:outline-3 focus-visible:outline-[var(--color-electric-cyan-400)]"
        id="tie-reason"
        maxLength={160}
        onChange={(event) => setReason(event.target.value)}
        value={reason}
      />
      {error ? (
        <p className="mt-3 text-sm text-[#ffc3c6]" role="alert">
          {error}
        </p>
      ) : null}
      <Button
        className="mt-4"
        disabled={disabled || saving}
        onClick={() => {
          setSaving(true);
          setError(null);
          void onConfirm(order, reason).catch((nextError: unknown) => {
            setSaving(false);
            setError(
              nextError instanceof Error
                ? nextError.message
                : "The tie decision could not be saved.",
            );
          });
        }}
        variant="dark"
      >
        {saving ? "Saving decision…" : "Confirm seed order"}
      </Button>
    </section>
  );
}

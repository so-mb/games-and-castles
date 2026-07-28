import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Pause, Play } from "lucide-react";
import { Button } from "../../../components/ui/Button";
import { Modal } from "../../../components/ui/Modal";
import type { SpecialRevealConfigInput } from "../domain/types";

const stages = [
  "Opening",
  "Prediction",
  "Option A resolution",
  "Option B resolution",
] as const;

export function SpecialRevealRehearsal({
  config,
  open,
  onClose,
}: {
  config: SpecialRevealConfigInput;
  open: boolean;
  onClose: () => void;
}) {
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const stage = stages[index]!;
  const payload =
    index === 2
      ? config.resolutionPayloads["option-a"]
      : index === 3
        ? config.resolutionPayloads["option-b"]
        : config.opening;

  useEffect(() => {
    if (!playing) return;
    const timer = window.setTimeout(() => {
      if (index === stages.length - 1) {
        setPlaying(false);
        return;
      }
      setIndex((current) => Math.min(stages.length - 1, current + 1));
    }, 1800);
    return () => window.clearTimeout(timer);
  }, [index, playing]);

  return (
    <Modal
      description="Private rehearsal only. These controls never write Firebase or invoke a callable."
      onClose={() => {
        setPlaying(false);
        onClose();
      }}
      open={open}
      size="wide"
      title="Special reveal rehearsal"
    >
      <div className="rounded-[var(--radius-xl)] border border-[var(--color-antique-gold-400)]/30 bg-black/20 p-6 text-center sm:p-10">
        <p className="text-xs font-bold tracking-[0.18em] text-[var(--color-antique-gold-400)] uppercase">
          {stage}
        </p>
        {index === 1 ? (
          <div>
            <h3 className="font-display mt-5 text-3xl font-semibold">
              {config.predictionPrompt || "Which option do you predict?"}
            </h3>
            <div className="mx-auto mt-6 grid max-w-lg gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-white/15 p-5 font-bold">
                {config.optionLabels["option-a"] || "Option A"}
              </div>
              <div className="rounded-2xl border border-white/15 p-5 font-bold">
                {config.optionLabels["option-b"] || "Option B"}
              </div>
            </div>
          </div>
        ) : (
          <div>
            <p aria-hidden="true" className="mt-5 text-4xl">
              ✦
            </p>
            <h3 className="font-display mt-4 text-4xl font-semibold">
              {payload.title || "A special announcement is ready."}
            </h3>
            <p className="mx-auto mt-4 max-w-2xl whitespace-pre-wrap leading-7 text-white/65">
              {payload.body || "Neutral rehearsal copy appears here."}
            </p>
          </div>
        )}
      </div>
      <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
        <Button
          disabled={index === 0}
          onClick={() => setIndex((current) => Math.max(0, current - 1))}
          variant="quiet"
        >
          <ChevronLeft aria-hidden="true" size={18} />
          Previous
        </Button>
        <Button
          onClick={() => setPlaying((current) => !current)}
          variant="quiet"
        >
          {playing ? (
            <Pause aria-hidden="true" size={18} />
          ) : (
            <Play aria-hidden="true" size={18} />
          )}
          {playing ? "Pause preview" : "Play preview"}
        </Button>
        <Button
          disabled={index === stages.length - 1}
          onClick={() =>
            setIndex((current) => Math.min(stages.length - 1, current + 1))
          }
          variant="dark"
        >
          Next
          <ChevronRight aria-hidden="true" size={18} />
        </Button>
      </div>
    </Modal>
  );
}

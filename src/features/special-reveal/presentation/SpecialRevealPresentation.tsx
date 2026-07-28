import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight, RotateCcw, X } from "lucide-react";
import { Button } from "../../../components/ui/Button";
import { IconButton } from "../../../components/ui/IconButton";
import type {
  SpecialRevealPublicOpening,
  SpecialRevealPublicResolution,
} from "../domain/types";

export function SpecialRevealPresentation({
  opening,
  resolution,
  onClose,
}: {
  opening: SpecialRevealPublicOpening;
  resolution: SpecialRevealPublicResolution;
  onClose: () => void;
}) {
  const reducedMotion = useReducedMotion();
  const [stage, setStage] = useState<"intro" | "resolved">("intro");
  const dialogRef = useRef<HTMLDivElement>(null);
  const returnFocus = useRef<HTMLElement | null>(null);

  useEffect(() => {
    returnFocus.current = document.activeElement as HTMLElement | null;
    dialogRef.current?.querySelector<HTMLElement>("button")?.focus();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      if (event.key === "ArrowRight") setStage("resolved");
      if (event.key === "ArrowLeft") setStage("intro");
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
      returnFocus.current?.focus();
    };
  }, [onClose]);

  const payload = stage === "intro" ? opening : resolution;
  return createPortal(
    <div className="fixed inset-0 z-[140] overflow-y-auto bg-[var(--color-night-950)] text-white">
      <div aria-hidden="true" className="special-reveal-radial" />
      {stage === "resolved" && !reducedMotion ? (
        <div aria-hidden="true" className="special-reveal-confetti" />
      ) : null}
      <div
        aria-label="Special reveal presentation"
        aria-modal="true"
        className="relative flex min-h-dvh flex-col p-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:p-8"
        ref={dialogRef}
        role="dialog"
      >
        <header className="flex items-center justify-between gap-4">
          <div>
            <p className="text-xs font-bold tracking-[0.2em] text-[var(--color-antique-gold-400)] uppercase">
              Special reveal
            </p>
            <p aria-live="polite" className="mt-1 text-sm text-white/60">
              {stage === "intro" ? "Opening" : "Resolution"}
            </p>
          </div>
          <IconButton
            className="border-white/20 text-white"
            label="Close special reveal presentation"
            onClick={onClose}
          >
            <X aria-hidden="true" size={20} />
          </IconButton>
        </header>
        <main className="flex flex-1 items-center justify-center py-8">
          <motion.article
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-4xl rounded-[2.25rem] border border-[var(--color-antique-gold-400)]/45 bg-[var(--color-night-900)] p-7 text-center shadow-[0_36px_130px_rgba(0,0,0,0.55)] sm:p-12 lg:p-16"
            initial={{
              opacity: reducedMotion ? 1 : 0,
              scale: reducedMotion ? 1 : 0.97,
            }}
            key={stage}
            transition={{ duration: reducedMotion ? 0 : 0.45 }}
          >
            <p aria-hidden="true" className="text-5xl">
              ✦
            </p>
            <h2 className="font-display mt-5 text-4xl leading-tight font-semibold sm:text-6xl">
              {payload.title}
            </h2>
            <p className="mx-auto mt-6 max-w-2xl whitespace-pre-wrap text-lg leading-8 text-white/75 sm:text-xl">
              {payload.body}
            </p>
            {stage === "resolved" ? (
              <div className="mx-auto mt-8 grid max-w-xl gap-3 rounded-2xl border border-white/10 bg-white/5 p-5 text-left sm:grid-cols-2">
                <p>
                  <span className="block text-xs font-bold tracking-wide text-white/50 uppercase">
                    Correct prediction
                  </span>
                  <span className="mt-1 block font-bold">
                    {resolution.correctOptionLabel}
                  </span>
                </p>
                <p>
                  <span className="block text-xs font-bold tracking-wide text-white/50 uppercase">
                    Predictions
                  </span>
                  <span className="mt-1 block font-bold">
                    {resolution.aggregate.total} total
                  </span>
                </p>
              </div>
            ) : null}
          </motion.article>
        </main>
        <footer className="mx-auto flex w-full max-w-xl justify-center gap-3 rounded-2xl border border-white/10 bg-white/5 p-3">
          {stage === "intro" ? (
            <Button onClick={() => setStage("resolved")} variant="dark">
              Continue
              <ArrowRight aria-hidden="true" size={18} />
            </Button>
          ) : (
            <Button onClick={() => setStage("intro")} variant="quiet">
              <RotateCcw aria-hidden="true" size={18} />
              Replay
            </Button>
          )}
        </footer>
      </div>
    </div>,
    document.body,
  );
}

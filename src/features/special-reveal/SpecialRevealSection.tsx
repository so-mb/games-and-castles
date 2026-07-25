import { ShieldQuestion } from "lucide-react";
import { Reveal } from "../../components/feedback/Reveal";
import { SectionShell } from "../../components/layout/SectionShell";
import { LockedContentCard } from "../../components/ui/LockedContentCard";
import { SectionHeading } from "../../components/ui/SectionHeading";
import { specialRevealState } from "../../data/lockedStates";

export function SpecialRevealSection() {
  return (
    <SectionShell
      className="special-reveal-section"
      id="reveal"
      labelledBy="reveal-title"
      tone="locked"
    >
      <SectionHeading
        description="An important weekend moment will eventually live here. For now, the design stays deliberately neutral."
        eyebrow="Presentation preview"
        id="reveal-title"
        title="Something waits beyond the lock"
        tone="dark"
      />

      <Reveal className="mt-9">
        <LockedContentCard state={specialRevealState}>
          <div className="grid gap-4 border-t border-white/8 pt-7 sm:grid-cols-2">
            {["Prediction choice", "Prediction choice"].map((label, index) => (
              <div
                aria-disabled="true"
                className="flex min-h-24 items-center gap-4 rounded-2xl border border-dashed border-white/15 bg-white/[0.025] p-4 text-white/45"
                key={`${label}-${index}`}
              >
                <span className="flex size-10 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/5">
                  <ShieldQuestion aria-hidden="true" size={20} />
                </span>
                <span>
                  <span className="block text-sm font-bold text-white/65">
                    {label}
                  </span>
                  <span className="mt-1 block text-xs">
                    Real labels arrive from a protected later phase.
                  </span>
                </span>
              </div>
            ))}
          </div>
        </LockedContentCard>
      </Reveal>
    </SectionShell>
  );
}

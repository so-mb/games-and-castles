import { Mail } from "lucide-react";
import { Reveal } from "../../components/feedback/Reveal";
import { SectionShell } from "../../components/layout/SectionShell";
import { Button } from "../../components/ui/Button";
import { LockedContentCard } from "../../components/ui/LockedContentCard";
import { SectionHeading } from "../../components/ui/SectionHeading";
import { birthdayVaultState } from "../../data/lockedStates";

export function BirthdayVaultSection() {
  return (
    <SectionShell
      className="birthday-section"
      id="birthday"
      labelledBy="birthday-title"
      tone="locked"
    >
      <SectionHeading
        description="The birthday note stays a warm subplot: thoughtful messages gathered quietly, then shared as one presentation later."
        eyebrow="A small celebration chapter"
        id="birthday-title"
        title="A guestbook behind the door"
        tone="dark"
      />

      <Reveal className="mt-9">
        <LockedContentCard state={birthdayVaultState}>
          <div className="grid gap-4 border-t border-white/8 pt-7 lg:grid-cols-[1fr_0.85fr]">
            <div className="rounded-2xl border border-dashed border-white/15 bg-white/[0.035] p-4 sm:p-5">
              <div className="flex items-center gap-3">
                <span className="flex size-10 items-center justify-center rounded-xl bg-[var(--color-antique-gold-400)]/10 text-[var(--color-antique-gold-400)]">
                  <Mail aria-hidden="true" size={20} />
                </span>
                <div>
                  <p className="text-sm font-bold">Message card preview</p>
                  <p className="text-xs text-white/45">
                    No message is submitted from this screen.
                  </p>
                </div>
              </div>
              <div aria-hidden="true" className="mt-5 space-y-3">
                <span className="block h-3 w-2/5 rounded-full bg-white/8" />
                <span className="block h-3 w-full rounded-full bg-white/6" />
                <span className="block h-3 w-4/5 rounded-full bg-white/6" />
              </div>
            </div>
            <div className="flex flex-col justify-center rounded-2xl border border-white/8 bg-black/15 p-4 sm:p-5">
              <p className="text-sm leading-6 text-white/56">
                The real form, private storage, moderation and publishing
                workflow begin in later phases.
              </p>
              <Button className="mt-4 self-start" disabled variant="dark">
                Submissions not open yet
              </Button>
            </div>
          </div>
        </LockedContentCard>
      </Reveal>
    </SectionShell>
  );
}

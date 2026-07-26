import { ArrowUp, ShieldCheck } from "lucide-react";
import { Reveal } from "../../components/feedback/Reveal";
import { SectionShell } from "../../components/layout/SectionShell";
import { ContentIcon } from "../../components/ui/ContentIcon";
import { IconButton } from "../../components/ui/IconButton";
import { SectionHeading } from "../../components/ui/SectionHeading";
import { Surface } from "../../components/ui/Surface";
import { publicTripInformation, tripMetadata } from "../../data/trip";

export function TripInformationSection() {
  return (
    <SectionShell id="trip-info" labelledBy="trip-info-title" tone="light">
      <div className="flex flex-wrap items-end justify-between gap-6">
        <SectionHeading
          description="The practical details everyone can safely keep close, without private addresses, phone numbers or booking references."
          eyebrow="Public-safe trip notes"
          id="trip-info-title"
          title="Useful, not overexposed"
        />
        <div className="flex items-center gap-2 text-sm font-bold text-[var(--color-prague-red-700)]">
          <ShieldCheck aria-hidden="true" size={19} />
          Static-safe information only
        </div>
      </div>

      <div className="mt-9 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {publicTripInformation.map((item, index) => (
          <Reveal delay={index * 0.035} key={item.id}>
            <Surface className="h-full p-5" variant="editorial">
              <span className="flex size-10 items-center justify-center rounded-xl bg-[var(--color-prague-red-600)]/7 text-[var(--color-prague-red-600)]">
                <ContentIcon name={item.icon} size={21} />
              </span>
              <p className="mt-5 text-xs font-bold tracking-[0.15em] text-[var(--color-ink-600)] uppercase">
                {item.label}
              </p>
              <h3 className="mt-1 text-lg leading-6 font-extrabold text-balance">
                {item.value}
              </h3>
              <p className="mt-2 text-sm leading-6 text-[var(--color-ink-600)]">
                {item.note}
              </p>
            </Surface>
          </Reveal>
        ))}
      </div>

      <footer className="mt-14 flex flex-col gap-5 border-t border-[var(--color-cream-200)] pt-7 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-display text-2xl font-semibold">
            {tripMetadata.productName}
          </p>
          <p className="mt-1 text-sm text-[var(--color-ink-600)]">
            {tripMetadata.dateRange} · {tripMetadata.context}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm font-semibold text-[var(--color-ink-600)]">
            Back to the beginning
          </span>
          <IconButton
            label="Back to the top"
            onClick={() =>
              document.getElementById("top")?.scrollIntoView({
                behavior: window.matchMedia("(prefers-reduced-motion: reduce)")
                  .matches
                  ? "auto"
                  : "smooth",
              })
            }
          >
            <ArrowUp aria-hidden="true" size={19} />
          </IconButton>
        </div>
      </footer>
    </SectionShell>
  );
}

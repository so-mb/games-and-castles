import { ArrowUp, BusFront, Clock3, MapPin, ShieldCheck } from "lucide-react";
import { Reveal } from "../../components/feedback/Reveal";
import { SectionShell } from "../../components/layout/SectionShell";
import { ContentIcon } from "../../components/ui/ContentIcon";
import { IconButton } from "../../components/ui/IconButton";
import { SectionHeading } from "../../components/ui/SectionHeading";
import { Surface } from "../../components/ui/Surface";
import {
  publicTripInformation,
  sundayDeparturePlan,
  tripMetadata,
} from "../../data/trip";

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

      <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
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

      <Reveal className="mt-9">
        <section
          aria-labelledby="sunday-departure-title"
          className="relative overflow-hidden rounded-[var(--radius-xl)] border border-[var(--color-antique-gold-400)]/30 bg-[var(--color-night-900)] p-5 text-[var(--color-paper-50)] shadow-[var(--shadow-dark)] sm:p-7 lg:p-9"
        >
          <div
            aria-hidden="true"
            className="absolute -top-20 -right-16 size-56 rounded-full border-[3rem] border-[var(--color-electric-cyan-400)]/[0.035]"
          />
          <div className="relative grid gap-7 lg:grid-cols-[0.8fr_1.2fr] lg:items-end">
            <div>
              <p className="flex items-center gap-2 text-xs font-bold tracking-[0.16em] text-[var(--color-antique-gold-400)] uppercase">
                <BusFront aria-hidden="true" size={17} />
                {sundayDeparturePlan.date} · Departure
              </p>
              <h3
                className="font-display mt-3 text-3xl leading-tight font-semibold sm:text-4xl"
                id="sunday-departure-title"
              >
                Three groups. One departure point.
              </h3>
              <p className="mt-4 max-w-lg text-sm leading-6 text-white/60 sm:text-base sm:leading-7">
                Everyone leaves Prague from the same central station, with each
                group keeping its own departure time.
              </p>
              <p className="mt-5 flex items-start gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-bold text-white/78">
                <MapPin
                  aria-hidden="true"
                  className="mt-0.5 shrink-0 text-[var(--color-electric-cyan-400)]"
                  size={18}
                />
                {sundayDeparturePlan.location}
              </p>
            </div>

            <ol
              aria-label="Sunday departure groups"
              className="grid gap-3 sm:grid-cols-3"
            >
              {sundayDeparturePlan.groups.map((group, index) => (
                <li
                  className="flex items-center gap-4 rounded-2xl border border-white/10 bg-white/[0.045] p-4 sm:block"
                  key={group.id}
                >
                  <span
                    aria-hidden="true"
                    className="flex size-9 shrink-0 items-center justify-center rounded-full border border-[var(--color-antique-gold-400)]/35 bg-[var(--color-antique-gold-400)]/10 font-score text-sm font-black text-[var(--color-antique-gold-400)]"
                  >
                    {index + 1}
                  </span>
                  <div className="min-w-0 flex-1 sm:mt-5">
                    <p className="text-xs font-bold tracking-[0.1em] text-white/48 uppercase">
                      {group.label}
                    </p>
                    <p className="mt-1 flex items-center gap-2">
                      <Clock3
                        aria-hidden="true"
                        className="text-[var(--color-electric-cyan-400)]"
                        size={17}
                      />
                      <time
                        className="font-score text-2xl font-black text-white tabular-nums"
                        dateTime={group.time}
                      >
                        {group.time}
                      </time>
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>
      </Reveal>

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

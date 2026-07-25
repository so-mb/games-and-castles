import { AlertTriangle, Camera, Route } from "lucide-react";
import { Reveal } from "../../components/feedback/Reveal";
import { SectionShell } from "../../components/layout/SectionShell";
import { SectionHeading } from "../../components/ui/SectionHeading";
import { StatusBadge } from "../../components/ui/StatusBadge";
import { TimelineItem } from "../../components/ui/TimelineItem";
import { delayRules, itineraryItems } from "../../data/itinerary";

export function ItinerarySection() {
  return (
    <SectionShell
      className="itinerary-section"
      id="itinerary"
      labelledBy="itinerary-title"
      tone="cream"
    >
      <div className="grid gap-8 lg:grid-cols-[1fr_auto] lg:items-end">
        <SectionHeading
          description="A focused route through free city highlights, photography stops and two fixed evening bookings. Times are the approved plan—not live navigation."
          eyebrow="Saturday, 1 August · Prague Quest"
          id="itinerary-title"
          title="One city, carefully paced"
        />
        <div className="flex flex-wrap gap-2 lg:justify-end">
          <StatusBadge icon="ticket" tone="success">
            Tourist attractions · free
          </StatusBadge>
          <StatusBadge icon="camera" tone="gold">
            Photo stops marked
          </StatusBadge>
        </div>
      </div>

      <aside
        aria-labelledby="delay-rules-title"
        className="mt-9 rounded-[var(--radius-lg)] border border-[var(--color-warning-500)]/35 bg-[#fff4dc] p-5 shadow-[var(--shadow-resting)]"
      >
        <div className="flex gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[var(--color-warning-500)]/18 text-[#6f4300]">
            <AlertTriangle aria-hidden="true" size={20} />
          </span>
          <div>
            <h3 className="font-extrabold" id="delay-rules-title">
              If the train runs late
            </h3>
            <ul className="mt-2 space-y-1.5 text-sm leading-6 text-[var(--color-ink-600)]">
              {delayRules.map((rule) => (
                <li className="flex gap-2" key={rule}>
                  <span aria-hidden="true">—</span>
                  <span>{rule}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </aside>

      <div className="mt-10 grid gap-8 lg:grid-cols-[1fr_16rem] lg:items-start">
        <ol
          aria-label="Approved Saturday itinerary"
          className="timeline-list relative"
        >
          {itineraryItems.map((item, index) => (
            <Reveal
              as="li"
              className="timeline-row relative grid gap-3 pb-8 last:pb-0 md:grid-cols-[8.5rem_2.5rem_1fr] md:gap-5"
              delay={Math.min(index * 0.025, 0.18)}
              key={item.id}
            >
              <TimelineItem index={index} item={item} />
            </Reveal>
          ))}
        </ol>

        <aside
          className="sticky top-24 hidden space-y-4 lg:block"
          aria-label="Prague Quest notes"
        >
          <div className="rounded-2xl border border-[var(--color-prague-red-600)]/20 bg-[var(--color-cream-50)] p-5 shadow-[var(--shadow-resting)]">
            <Route
              aria-hidden="true"
              className="text-[var(--color-prague-red-600)]"
              size={22}
            />
            <h3 className="mt-3 font-extrabold">Route rhythm</h3>
            <p className="mt-2 text-sm leading-6 text-[var(--color-ink-600)]">
              Museum → castle → riverside → Old Town → Flora.
            </p>
          </div>
          <div className="rounded-2xl border border-[var(--color-antique-gold-600)]/25 bg-[var(--color-cream-50)] p-5 shadow-[var(--shadow-resting)]">
            <Camera
              aria-hidden="true"
              className="text-[var(--color-antique-gold-600)]"
              size={22}
            />
            <h3 className="mt-3 font-extrabold">Photo priorities</h3>
            <p className="mt-2 text-sm leading-6 text-[var(--color-ink-600)]">
              Castle viewpoints, Wallenstein Garden, Charles Bridge and Old Town
              Square.
            </p>
          </div>
        </aside>
      </div>
    </SectionShell>
  );
}

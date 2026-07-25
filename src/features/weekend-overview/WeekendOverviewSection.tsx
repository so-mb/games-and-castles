import { Shuffle } from "lucide-react";
import { Reveal } from "../../components/feedback/Reveal";
import { SectionShell } from "../../components/layout/SectionShell";
import { ContentIcon } from "../../components/ui/ContentIcon";
import { DayCard } from "../../components/ui/DayCard";
import { SectionHeading } from "../../components/ui/SectionHeading";
import { StatusBadge } from "../../components/ui/StatusBadge";
import { gameNightActivities } from "../../data/gameNight";
import { weekendDays } from "../../data/trip";

export function WeekendOverviewSection() {
  return (
    <SectionShell id="weekend" labelledBy="weekend-title" tone="cream">
      <SectionHeading
        description="The weekend changes rhythm as it goes: an unscheduled opening night, one carefully plotted city day, then a simple departure."
        eyebrow="The whole weekend"
        id="weekend-title"
        title="Three days, three different speeds"
      />

      <div className="mt-10 grid gap-5 md:grid-cols-2 lg:gap-6">
        {weekendDays.map((day, index) => (
          <Reveal
            className={day.id === "sunday" ? "md:col-span-2" : undefined}
            delay={index * 0.06}
            key={day.id}
          >
            <DayCard day={day} />
          </Reveal>
        ))}
      </div>

      <div
        className="game-night-board relative mt-14 overflow-hidden rounded-[var(--radius-xl)] border border-[var(--color-antique-gold-400)]/25 bg-[var(--color-night-950)] p-5 text-[var(--color-paper-50)] shadow-[var(--shadow-dark)] sm:p-7 lg:p-9"
        id="game-night"
      >
        <div aria-hidden="true" className="game-board-grid" />
        <div className="relative z-10 grid gap-8 lg:grid-cols-[0.75fr_1.25fr] lg:items-end">
          <div>
            <StatusBadge icon="dice" tone="gold">
              Any order
            </StatusBadge>
            <h3 className="font-display mt-5 text-4xl leading-none font-semibold sm:text-5xl">
              Friday has no clock.
            </h3>
            <p className="mt-4 max-w-lg text-base leading-7 text-[var(--color-paper-300)]">
              Pick what feels right, switch tables, take a food break and bring
              the championship in when the room is ready.
            </p>
            <p className="mt-5 flex items-center gap-2 text-sm font-bold text-[var(--color-electric-cyan-400)]">
              <Shuffle aria-hidden="true" size={17} />
              Flexible by design — no activity times are assigned.
            </p>
          </div>

          <ul
            aria-label="Flexible Friday activities"
            className="grid grid-cols-2 gap-2 sm:grid-cols-3"
          >
            {gameNightActivities.map((activity) => (
              <li
                className="flex min-h-24 flex-col justify-between rounded-2xl border border-white/9 bg-white/[0.045] p-3 transition hover:-translate-y-0.5 hover:border-[var(--color-electric-cyan-400)]/35 hover:bg-white/[0.065] motion-reduce:transform-none"
                key={activity.id}
              >
                <ContentIcon
                  className="text-[var(--color-electric-cyan-400)]"
                  name={activity.icon}
                  size={21}
                />
                <span className="mt-3 text-sm leading-5 font-bold text-white">
                  {activity.label}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </SectionShell>
  );
}

import { ArrowRight, CircleDot, Swords } from "lucide-react";
import { Reveal } from "../../components/feedback/Reveal";
import { EmptyState } from "../../components/feedback/EmptyState";
import { SectionShell } from "../../components/layout/SectionShell";
import { Button } from "../../components/ui/Button";
import { ContentIcon } from "../../components/ui/ContentIcon";
import { LeaderboardRow } from "../../components/ui/LeaderboardRow";
import { ParticipantAvatar } from "../../components/ui/ParticipantAvatar";
import { Podium } from "../../components/ui/Podium";
import { SectionHeading } from "../../components/ui/SectionHeading";
import { StatusBadge } from "../../components/ui/StatusBadge";
import { Surface } from "../../components/ui/Surface";
import {
  competitionPreviews,
  mockActiveMatch,
  mockLeaderboard,
  mockRecentPoints,
} from "../../data/mockChampionship";
import { ParticipantLivePanel } from "../participants/ParticipantLivePanel";

export function ChampionshipSection() {
  return (
    <SectionShell
      className="championship-section"
      id="championship"
      labelledBy="championship-title"
      tone="dark"
    >
      <div aria-hidden="true" className="championship-grid" />
      <div className="relative z-10">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <SectionHeading
            description="The participant roster is now shared live. Competition scores remain a clearly labelled visual preview for a later phase."
            eyebrow="Live roster · championship preview"
            id="championship-title"
            title="The table is almost open"
            tone="dark"
          />
          <StatusBadge icon="trophy" tone="live">
            Championship opens Friday
          </StatusBadge>
        </div>

        <p className="mt-5 max-w-2xl rounded-xl border border-white/8 bg-white/[0.035] px-4 py-3 text-sm leading-6 text-white/58">
          Participant names below are live when Firebase is configured. Every
          score, match and competition card remains sample-only in Phase 2.
        </p>

        <div className="mt-7">
          <ParticipantLivePanel />
        </div>

        <div className="mt-12 grid gap-5 lg:grid-cols-[0.95fr_1.05fr]">
          <Reveal>
            <Surface className="h-full p-5 sm:p-6" variant="celebration">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-bold tracking-[0.16em] text-[var(--color-antique-gold-400)] uppercase">
                    Sample leaderboard
                  </p>
                  <h3 className="mt-1 text-xl font-extrabold">
                    Podium preview
                  </h3>
                </div>
                <ContentIcon
                  className="text-[var(--color-antique-gold-400)]"
                  name="crown"
                  size={25}
                />
              </div>
              <Podium className="mt-7" entries={mockLeaderboard} />
              <ol className="mt-5 space-y-2" start={1}>
                {mockLeaderboard.map((entry) => (
                  <LeaderboardRow entry={entry} key={entry.id} />
                ))}
              </ol>
            </Surface>
          </Reveal>

          <div className="grid gap-5">
            <Reveal delay={0.06}>
              <Surface className="p-5 sm:p-6" variant="live">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <StatusBadge tone="live">Active match · sample</StatusBadge>
                    <h3 className="mt-3 text-xl font-extrabold">
                      {mockActiveMatch.competitionLabel}
                    </h3>
                    <p className="mt-1 text-sm text-white/50">
                      {mockActiveMatch.roundLabel}
                    </p>
                  </div>
                  <Swords
                    aria-hidden="true"
                    className="text-[var(--color-electric-cyan-400)]"
                    size={25}
                  />
                </div>

                <div className="mt-6 grid grid-cols-[1fr_auto_1fr] items-center gap-3">
                  <div className="min-w-0 text-center">
                    <ParticipantAvatar
                      accent="gold"
                      className="mx-auto"
                      initials={mockActiveMatch.participantA.initials}
                      name={mockActiveMatch.participantA.displayName}
                      size="lg"
                    />
                    <p className="mt-2 truncate text-sm font-bold">
                      {mockActiveMatch.participantA.displayName}
                    </p>
                  </div>
                  <div className="font-score rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-3xl font-black tabular-nums">
                    {mockActiveMatch.scoreA}
                    <span className="px-2 text-white/28">:</span>
                    {mockActiveMatch.scoreB}
                  </div>
                  <div className="min-w-0 text-center">
                    <ParticipantAvatar
                      accent="cyan"
                      className="mx-auto"
                      initials={mockActiveMatch.participantB.initials}
                      name={mockActiveMatch.participantB.displayName}
                      size="lg"
                    />
                    <p className="mt-2 truncate text-sm font-bold">
                      {mockActiveMatch.participantB.displayName}
                    </p>
                  </div>
                </div>

                <div id="preview-control-note" className="mt-6 text-center">
                  <Button
                    aria-describedby="preview-control-note"
                    disabled
                    variant="dark"
                  >
                    Results open in a later phase
                  </Button>
                </div>
              </Surface>
            </Reveal>

            <Reveal delay={0.1}>
              <Surface className="p-5" variant="championship">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-bold tracking-[0.15em] text-white/45 uppercase">
                      Sample activity
                    </p>
                    <h3 className="mt-1 text-lg font-extrabold">
                      Recent points
                    </h3>
                  </div>
                  <CircleDot
                    aria-hidden="true"
                    className="text-white/35"
                    size={20}
                  />
                </div>
                <ul className="mt-4 divide-y divide-white/8">
                  {mockRecentPoints.map((activity) => (
                    <li
                      className="grid grid-cols-[1fr_auto] gap-3 py-3 first:pt-0 last:pb-0"
                      key={activity.id}
                    >
                      <span>
                        <span className="block text-sm font-bold text-white">
                          {activity.displayName}
                        </span>
                        <span className="block text-xs text-white/45">
                          {activity.reason} · {activity.timeLabel}
                        </span>
                      </span>
                      <span className="font-score self-center text-lg font-black text-[var(--color-electric-cyan-400)]">
                        +{activity.points}
                      </span>
                    </li>
                  ))}
                </ul>
              </Surface>
            </Reveal>
          </div>
        </div>

        <div className="mt-12">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs font-bold tracking-[0.16em] text-[var(--color-electric-cyan-400)] uppercase">
                Three ways to play
              </p>
              <h3 className="font-display mt-2 text-3xl font-semibold sm:text-4xl">
                Competition formats
              </h3>
            </div>
            <p className="max-w-md text-sm leading-6 text-white/50">
              Names are entered later; these reusable structures stay
              independent of any particular game.
            </p>
          </div>
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            {competitionPreviews.map((competition, index) => (
              <Reveal delay={index * 0.05} key={competition.id}>
                <Surface
                  className="format-card group h-full p-5"
                  variant="championship"
                >
                  <div className="flex items-start justify-between gap-4">
                    <span className="flex size-11 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-[var(--color-electric-cyan-400)]">
                      <ContentIcon name={competition.icon} size={22} />
                    </span>
                    <StatusBadge tone="neutral">Preview</StatusBadge>
                  </div>
                  <h4 className="mt-6 text-xl font-extrabold">
                    {competition.label}
                  </h4>
                  <p className="mt-2 text-sm leading-6 text-white/55">
                    {competition.description}
                  </p>
                  <p className="mt-6 flex items-center gap-2 text-xs font-bold tracking-[0.08em] text-[var(--color-antique-gold-400)] uppercase">
                    {competition.structure}
                    <ArrowRight aria-hidden="true" size={14} />
                  </p>
                </Surface>
              </Reveal>
            ))}
          </div>
        </div>

        <div className="mt-12 grid gap-5 lg:grid-cols-[1.4fr_0.6fr]">
          <Reveal>
            <Surface
              className="overflow-hidden p-5 sm:p-6"
              variant="championship"
            >
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-xs font-bold tracking-[0.15em] text-white/45 uppercase">
                    Bracket language
                  </p>
                  <h3 className="mt-1 text-lg font-extrabold">
                    Progression preview
                  </h3>
                </div>
                <StatusBadge tone="neutral">Sample only</StatusBadge>
              </div>
              <div
                aria-label="Sample bracket: semifinal winners advance to the final"
                className="bracket-scroll mt-5 overflow-x-auto pb-2"
                role="img"
                tabIndex={0}
              >
                <div
                  aria-hidden="true"
                  className="bracket-preview grid min-w-[37rem] grid-cols-[1fr_5rem_1fr_5rem_1fr] items-center"
                >
                  <div className="space-y-8">
                    <div className="bracket-match">
                      <span>Semi 1</span>
                      <strong>Player A</strong>
                    </div>
                    <div className="bracket-match">
                      <span>Semi 2</span>
                      <strong>Player B</strong>
                    </div>
                  </div>
                  <div className="bracket-line" />
                  <div className="bracket-match">
                    <span>Final</span>
                    <strong>Winner 1</strong>
                  </div>
                  <div className="bracket-line" />
                  <div className="bracket-match bracket-trophy">
                    <span>Champion</span>
                    <strong>To be played</strong>
                  </div>
                </div>
              </div>
            </Surface>
          </Reveal>
          <Reveal delay={0.06}>
            <EmptyState
              description="Real standings will begin with everyone level. Nothing here is saved or shared yet."
              icon="trophy"
              title="Games begin soon"
            />
          </Reveal>
        </div>
      </div>
    </SectionShell>
  );
}

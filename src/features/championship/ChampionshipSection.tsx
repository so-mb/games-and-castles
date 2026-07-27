import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  Award,
  ChevronRight,
  CircleDot,
  Crown,
  Sparkles,
  Trophy,
} from "lucide-react";
import { Reveal } from "../../components/feedback/Reveal";
import { EmptyState } from "../../components/feedback/EmptyState";
import { SectionShell } from "../../components/layout/SectionShell";
import { Button } from "../../components/ui/Button";
import { ParticipantAvatar } from "../../components/ui/ParticipantAvatar";
import { Podium } from "../../components/ui/Podium";
import { SectionHeading } from "../../components/ui/SectionHeading";
import { StatusBadge } from "../../components/ui/StatusBadge";
import { Surface } from "../../components/ui/Surface";
import { competitionPreviews } from "../../data/mockChampionship";
import type { LeaderboardEntry } from "../../types/content";
import { ParticipantLivePanel } from "../participants/ParticipantLivePanel";
import { PublicCompetitionList } from "../competitions/public/PublicCompetitionList";
import { useChampionship } from "./ChampionshipProvider";
import type { ChampionshipStanding } from "./domain/types";
import { ChampionshipParticipantDetail } from "./public/ChampionshipParticipantDetail";

const formatLabels = {
  "round-robin-knockout": "Merry-Go-Round",
  "all-hands": "All Hands",
  "group-knockout": "Group Format",
} as const;

function initials(name: string) {
  return name
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function podiumEntries(standings: ChampionshipStanding[]): LeaderboardEntry[] {
  return standings.slice(0, 3).map((standing, index) => ({
    id: standing.participantId,
    rank: standing.rank,
    displayName: standing.displayName,
    initials: initials(standing.displayName),
    points: standing.totalPoints,
    note: standing.tied
      ? "Shared rank"
      : `${standing.competitionsScored} competitions`,
    accent:
      standing.participant?.avatar.tone ??
      (["gold", "cyan", "red"][index] as "gold" | "cyan" | "red"),
  }));
}

export function ChampionshipSection() {
  const championship = useChampionship();
  const [selected, setSelected] = useState<ChampionshipStanding | null>(null);
  const [scoreAnnouncement, setScoreAnnouncement] = useState("");
  const previousTotals = useRef(new Map<string, number>());
  const hasPoints = championship.standings.some(
    (standing) => standing.totalPoints > 0,
  );
  const verificationItems = championship.reconciliation.filter((item) =>
    [
      "missing",
      "stale",
      "malformed-run",
      "malformed-source",
      "unsupported",
    ].includes(item.status),
  );
  const recentAwards = useMemo(() => {
    const byId = new Map(
      championship.standings.flatMap((standing) =>
        standing.recentAwards.map((award) => [award.id, award] as const),
      ),
    );
    return [...byId.values()]
      .sort(
        (left, right) =>
          right.awardedAt - left.awardedAt || left.id.localeCompare(right.id),
      )
      .slice(0, 8);
  }, [championship.standings]);
  const names = new Map(
    championship.standings.map((standing) => [
      standing.participantId,
      standing.displayName,
    ]),
  );

  useEffect(() => {
    const changes = championship.standings.flatMap((standing) => {
      const previous = previousTotals.current.get(standing.participantId);
      const difference =
        previous === undefined ? 0 : standing.totalPoints - previous;
      return difference === 0 ? [] : [{ standing, difference }];
    });
    if (changes.length === 1) {
      const change = changes[0]!;
      setScoreAnnouncement(
        `Leaderboard updated. ${change.standing.displayName} ${change.difference > 0 ? "gained" : "lost"} ${Math.abs(change.difference)} points.`,
      );
    } else if (changes.length > 1) {
      setScoreAnnouncement("Leaderboard updated for multiple participants.");
    }
    previousTotals.current = new Map(
      championship.standings.map((standing) => [
        standing.participantId,
        standing.totalPoints,
      ]),
    );
  }, [championship.standings]);

  return (
    <SectionShell
      className="championship-section"
      id="championship"
      labelledBy="championship-title"
      tone="dark"
    >
      <div aria-hidden="true" className="championship-grid" />
      <div className="relative z-10">
        <p aria-live="polite" className="sr-only">
          {scoreAnnouncement}
        </p>
        <div className="flex flex-wrap items-end justify-between gap-6">
          <SectionHeading
            description="Every current award is traced to a competition result or an organizer bonus. Totals are rebuilt live from that itemized ledger."
            eyebrow="Realtime ledger · transparent scoring"
            id="championship-title"
            title="Weekend championship"
            tone="dark"
          />
          <StatusBadge icon="trophy" tone={hasPoints ? "live" : "neutral"}>
            {hasPoints ? "Championship live" : "Awaiting first result"}
          </StatusBadge>
        </div>

        {verificationItems.length > 0 ||
        championship.malformedBonusIds.length > 0 ? (
          <div
            className="mt-6 flex gap-3 rounded-2xl border border-[var(--color-warning-500)]/35 bg-[var(--color-warning-500)]/8 p-4 text-sm leading-6 text-white/72"
            role="status"
          >
            <AlertTriangle
              aria-hidden="true"
              className="mt-0.5 shrink-0 text-[var(--color-warning-500)]"
              size={19}
            />
            <span>
              Some points are awaiting organizer verification. Valid current
              sources remain visible, but this table should not be treated as
              final until Championship Sync is clear.
            </span>
          </div>
        ) : null}

        <div className="mt-7">
          <ParticipantLivePanel />
        </div>

        {hasPoints ? (
          <div className="mt-12 grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
            <Reveal>
              <Surface className="h-full p-5 sm:p-6" variant="celebration">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-bold tracking-[0.16em] text-[var(--color-antique-gold-400)] uppercase">
                      Live podium
                    </p>
                    <h3 className="mt-1 text-xl font-extrabold">
                      {championship.standings[0]?.tied
                        ? "Co-leaders at the table"
                        : "Current leaders"}
                    </h3>
                  </div>
                  <Crown
                    aria-hidden="true"
                    className="text-[var(--color-antique-gold-400)]"
                    size={25}
                  />
                </div>
                <Podium
                  ariaLabel="Current top-three championship podium"
                  className="mt-7"
                  entries={podiumEntries(championship.standings)}
                />
              </Surface>
            </Reveal>

            <Reveal delay={0.05}>
              <Surface className="p-5 sm:p-6" variant="live">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-bold tracking-[0.15em] text-white/45 uppercase">
                      Full table
                    </p>
                    <h3 className="mt-1 text-xl font-extrabold">Leaderboard</h3>
                  </div>
                  <Trophy
                    aria-hidden="true"
                    className="text-[var(--color-electric-cyan-400)]"
                    size={23}
                  />
                </div>
                <ol className="mt-5 space-y-2">
                  {championship.standings.map((standing) => (
                    <li key={standing.participantId}>
                      <button
                        aria-label={`Open ${standing.displayName}'s score breakdown`}
                        className="grid min-h-14 w-full grid-cols-[2rem_auto_1fr_auto] items-center gap-3 rounded-xl border border-white/8 bg-white/[0.035] px-3 py-3 text-left transition-colors hover:bg-white/[0.07] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-electric-cyan-400)]"
                        onClick={() => setSelected(standing)}
                        type="button"
                      >
                        <span
                          aria-label={`Rank ${standing.rank}${standing.tied ? ", tied" : ""}`}
                          className="font-score text-center text-sm font-extrabold text-white/55"
                        >
                          {standing.rank}
                        </span>
                        <ParticipantAvatar
                          accent={
                            standing.participant?.avatar.tone ?? "neutral"
                          }
                          icon={standing.participant?.avatar.icon}
                          initials={initials(standing.displayName)}
                          name={standing.displayName}
                          size="sm"
                        />
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-bold text-white">
                            {standing.displayName}
                            {standing.tied ? " · tied" : ""}
                          </span>
                          <span className="block truncate text-xs text-white/48">
                            {standing.competitionPoints} competition ·{" "}
                            {standing.bonusPoints} bonus ·{" "}
                            {standing.competitionsScored} scored
                          </span>
                        </span>
                        <span className="flex items-center gap-2">
                          <span className="font-score text-lg font-black text-white">
                            {standing.totalPoints}
                            <span className="ml-1 text-[0.65rem] text-white/45 uppercase">
                              pts
                            </span>
                          </span>
                          <ChevronRight
                            aria-hidden="true"
                            className="text-white/30"
                            size={16}
                          />
                        </span>
                      </button>
                    </li>
                  ))}
                </ol>
              </Surface>
            </Reveal>
          </div>
        ) : (
          <div className="mt-12">
            <EmptyState
              description="Registered participants remain visible, and the table will update as soon as a valid result or bonus creates the first award."
              icon="trophy"
              title="Championship begins when results are recorded"
            />
          </div>
        )}

        <div className="mt-12 grid gap-5 lg:grid-cols-[1.15fr_0.85fr]">
          <Surface className="p-5 sm:p-6" variant="championship">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-bold tracking-[0.15em] text-white/45 uppercase">
                  Source totals
                </p>
                <h3 className="mt-1 text-lg font-extrabold">
                  Competition contributions
                </h3>
              </div>
              <Award
                aria-hidden="true"
                className="text-[var(--color-antique-gold-400)]"
                size={22}
              />
            </div>
            {championship.sources.length === 0 ? (
              <p className="mt-5 rounded-xl border border-dashed border-white/12 p-5 text-sm leading-6 text-white/52">
                No competition sources have awarded points yet.
              </p>
            ) : (
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                {championship.sources.map((source) => {
                  const sourceEntries = Object.values(source.entries);
                  const totals = new Map<string, number>();
                  sourceEntries.forEach((entry) =>
                    totals.set(
                      entry.participantId,
                      (totals.get(entry.participantId) ?? 0) + entry.points,
                    ),
                  );
                  const leader = [...totals].sort((a, b) => b[1] - a[1])[0];
                  const sync = championship.reconciliation.find(
                    (item) => item.competitionId === source.meta.competitionId,
                  );
                  return (
                    <article
                      className="rounded-2xl border border-white/9 bg-white/[0.035] p-4"
                      key={source.meta.competitionId}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h4 className="font-bold text-white">
                            {source.meta.competitionTitle}
                          </h4>
                          <p className="mt-1 text-xs text-white/45">
                            {formatLabels[source.meta.competitionFormat]} ·{" "}
                            {source.meta.competitionStatus}
                          </p>
                        </div>
                        <StatusBadge
                          tone={sync?.status === "in-sync" ? "live" : "warning"}
                        >
                          {sync?.status === "in-sync"
                            ? "Verified"
                            : "Check sync"}
                        </StatusBadge>
                      </div>
                      <p className="font-score mt-5 text-2xl font-black text-white">
                        {sourceEntries.reduce(
                          (sum, entry) => sum + entry.points,
                          0,
                        )}
                        <span className="ml-1 text-xs text-white/40 uppercase">
                          pts awarded
                        </span>
                      </p>
                      <p className="mt-2 text-xs text-white/50">
                        {leader
                          ? `${names.get(leader[0]) ?? "Unavailable participant"} leads with ${leader[1]}`
                          : "No points awarded yet"}
                      </p>
                      <Button
                        className="mt-4"
                        href={`#competition-${source.meta.competitionId}`}
                        variant="quiet"
                      >
                        Open competition
                      </Button>
                    </article>
                  );
                })}
              </div>
            )}
          </Surface>

          <Surface className="p-5 sm:p-6" variant="championship">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-bold tracking-[0.15em] text-white/45 uppercase">
                  Current ledger view
                </p>
                <h3 className="mt-1 text-lg font-extrabold">
                  Latest scoring awards
                </h3>
              </div>
              <CircleDot
                aria-hidden="true"
                className="text-[var(--color-electric-cyan-400)]"
                size={20}
              />
            </div>
            {recentAwards.length === 0 ? (
              <p className="mt-5 text-sm leading-6 text-white/52">
                Latest valid awards will appear here. This is a view of current
                entries, not an immutable activity log.
              </p>
            ) : (
              <ul className="mt-4 divide-y divide-white/8">
                {recentAwards.map((award) => (
                  <li
                    className="grid grid-cols-[1fr_auto] gap-3 py-3 first:pt-0"
                    key={award.id}
                  >
                    <span>
                      <span className="block text-sm font-bold text-white">
                        {names.get(award.participantId) ??
                          "Unavailable participant"}
                      </span>
                      <span className="block text-xs text-white/45">
                        {award.label}
                        {award.competitionTitle
                          ? ` · ${award.competitionTitle}`
                          : " · Organizer bonus"}
                      </span>
                    </span>
                    <span className="font-score self-center text-lg font-black text-[var(--color-electric-cyan-400)]">
                      +{award.points}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Surface>
        </div>

        {championship.achievements.length > 0 ? (
          <div className="mt-12">
            <div className="flex items-center gap-3">
              <Sparkles
                aria-hidden="true"
                className="text-[var(--color-antique-gold-400)]"
                size={22}
              />
              <div>
                <p className="text-xs font-bold tracking-[0.15em] text-white/45 uppercase">
                  Score-neutral
                </p>
                <h3 className="text-lg font-extrabold">Current achievements</h3>
              </div>
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {championship.achievements.map((achievement) => (
                <article
                  className="rounded-2xl border border-[var(--color-antique-gold-400)]/18 bg-[var(--color-antique-gold-400)]/6 p-4"
                  key={achievement.id}
                >
                  <h4 className="font-display text-xl font-semibold text-[var(--color-antique-gold-400)]">
                    {achievement.title}
                  </h4>
                  <p className="mt-1 text-sm font-bold text-white">
                    {achievement.participantIds
                      .map((id) => names.get(id) ?? "Unavailable participant")
                      .join(" · ")}
                  </p>
                  <p className="mt-2 text-xs leading-5 text-white/48">
                    {achievement.criterion}. Achievements do not award points.
                  </p>
                </article>
              ))}
            </div>
          </div>
        ) : null}

        <PublicCompetitionList />

        <div className="mt-12">
          <div>
            <p className="text-xs font-bold tracking-[0.16em] text-[var(--color-electric-cyan-400)] uppercase">
              Three ways to play
            </p>
            <h3 className="font-display mt-2 text-3xl font-semibold sm:text-4xl">
              Competition formats
            </h3>
          </div>
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            {competitionPreviews.map((competition) => (
              <Surface
                className="h-full p-5"
                key={competition.id}
                variant="championship"
              >
                <h4 className="text-xl font-extrabold">{competition.label}</h4>
                <p className="mt-2 text-sm leading-6 text-white/55">
                  {competition.description}
                </p>
                <p className="mt-5 text-xs font-bold tracking-[0.08em] text-[var(--color-antique-gold-400)] uppercase">
                  {competition.structure}
                </p>
              </Surface>
            ))}
          </div>
        </div>
      </div>

      <ChampionshipParticipantDetail
        achievements={championship.achievements.filter((achievement) =>
          selected
            ? achievement.participantIds.includes(selected.participantId)
            : false,
        )}
        onClose={() => setSelected(null)}
        open={Boolean(selected)}
        standing={selected}
      />
    </SectionShell>
  );
}

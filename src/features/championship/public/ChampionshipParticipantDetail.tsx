import { useMemo, useState } from "react";
import { Award, Trophy } from "lucide-react";
import { Modal } from "../../../components/ui/Modal";
import { StatusBadge } from "../../../components/ui/StatusBadge";
import type {
  ChampionshipAchievement,
  ChampionshipStanding,
} from "../domain/types";

interface Props {
  open: boolean;
  standing: ChampionshipStanding | null;
  achievements: ChampionshipAchievement[];
  onClose: () => void;
}

export function ChampionshipParticipantDetail({
  open,
  standing,
  achievements,
  onClose,
}: Props) {
  const [competitionFilter, setCompetitionFilter] = useState("all");
  const [awardFilter, setAwardFilter] = useState("all");
  const awards = useMemo(
    () =>
      standing?.awards.filter(
        (award) =>
          (competitionFilter === "all" ||
            award.competitionId === competitionFilter ||
            (competitionFilter === "bonus" && !award.competitionId)) &&
          (awardFilter === "all" || award.awardType === awardFilter),
      ) ?? [],
    [awardFilter, competitionFilter, standing],
  );
  const awardTypes = [
    ...new Set(standing?.awards.map((award) => award.awardType) ?? []),
  ];
  if (!standing) return null;

  return (
    <Modal
      description="A ledger-derived explanation of every current point in this participant’s current award view."
      onClose={onClose}
      open={open}
      size="wide"
      title={`${standing.displayName} · score breakdown`}
    >
      <div className="grid gap-3 sm:grid-cols-4">
        {[
          ["Rank", `${standing.rank}${standing.tied ? " · tied" : ""}`],
          ["Total", `${standing.totalPoints} pts`],
          ["Competition", `${standing.competitionPoints} pts`],
          ["Bonuses", `${standing.bonusPoints} pts`],
        ].map(([label, value]) => (
          <div
            className="rounded-2xl border border-white/10 bg-white/[0.035] p-4"
            key={label}
          >
            <p className="text-xs text-white/45">{label}</p>
            <p className="font-score mt-1 text-lg font-black">{value}</p>
          </div>
        ))}
      </div>

      {standing.isMissingParticipant ? (
        <p className="mt-4 rounded-xl border border-[var(--color-warning-500)]/30 bg-[var(--color-warning-500)]/8 p-3 text-sm text-white/70">
          The participant record is unavailable; historical awards remain safely
          attributed to its stable record ID.
        </p>
      ) : standing.participant?.status === "inactive" ? (
        <div className="mt-4">
          <StatusBadge tone="neutral">
            Inactive participant · historical points retained
          </StatusBadge>
        </div>
      ) : null}

      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        <label className="text-sm font-bold">
          Competition
          <select
            className="mt-2 min-h-11 w-full rounded-xl border border-white/15 bg-[var(--color-night-900)] px-3"
            onChange={(event) => setCompetitionFilter(event.target.value)}
            value={competitionFilter}
          >
            <option value="all">All sources</option>
            {standing.contributions.map((contribution) => (
              <option
                key={contribution.competitionId}
                value={contribution.competitionId}
              >
                {contribution.title}
              </option>
            ))}
            {standing.bonusPoints > 0 ? (
              <option value="bonus">Manual bonuses</option>
            ) : null}
          </select>
        </label>
        <label className="text-sm font-bold">
          Award type
          <select
            className="mt-2 min-h-11 w-full rounded-xl border border-white/15 bg-[var(--color-night-900)] px-3"
            onChange={(event) => setAwardFilter(event.target.value)}
            value={awardFilter}
          >
            <option value="all">All award types</option>
            {awardTypes.map((awardType) => (
              <option key={awardType} value={awardType}>
                {awardType.replaceAll("-", " ")}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="mt-6">
        <h3 className="flex items-center gap-2 font-extrabold">
          <Trophy aria-hidden="true" size={18} /> Competition subtotals
        </h3>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {standing.contributions.map((contribution) => (
            <div
              className="rounded-xl border border-white/10 p-3"
              key={contribution.competitionId}
            >
              <p className="font-bold">{contribution.title}</p>
              <p className="font-score mt-1 text-sm text-[var(--color-electric-cyan-400)]">
                {contribution.points} pts · {contribution.awards.length} awards
              </p>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-6">
        <h3 className="flex items-center gap-2 font-extrabold">
          <Award aria-hidden="true" size={18} /> Itemized awards
        </h3>
        {awards.length === 0 ? (
          <p className="mt-3 rounded-xl border border-dashed border-white/15 p-4 text-sm text-white/50">
            No current awards match these filters.
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-white/8 rounded-xl border border-white/10 px-4">
            {awards.map((award) => (
              <li
                className="grid grid-cols-[1fr_auto] gap-3 py-3"
                key={award.id}
              >
                <span>
                  <span className="block text-sm font-bold">{award.label}</span>
                  <span className="block text-xs text-white/45">
                    {award.competitionTitle ?? "Organizer bonus"} ·{" "}
                    {award.awardType.replaceAll("-", " ")}
                  </span>
                </span>
                <span className="font-score self-center font-black text-[var(--color-electric-cyan-400)]">
                  +{award.points}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {achievements.length > 0 ? (
        <div className="mt-6">
          <h3 className="font-extrabold">Achievements</h3>
          <ul className="mt-3 flex flex-wrap gap-2">
            {achievements.map((achievement) => (
              <li
                className="rounded-full border border-[var(--color-antique-gold-400)]/25 px-3 py-2 text-xs text-[var(--color-antique-gold-400)]"
                key={achievement.id}
              >
                {achievement.title} · {achievement.criterion}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </Modal>
  );
}

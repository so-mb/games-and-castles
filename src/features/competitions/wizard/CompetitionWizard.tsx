import { useEffect, useMemo, useState, type ReactNode } from "react";
import { motion, useReducedMotion } from "framer-motion";
import {
  AlertTriangle,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  Save,
  Send,
} from "lucide-react";
import { Button } from "../../../components/ui/Button";
import { ContentIcon } from "../../../components/ui/ContentIcon";
import { Modal } from "../../../components/ui/Modal";
import { ParticipantAvatar } from "../../../components/ui/ParticipantAvatar";
import { StatusBadge } from "../../../components/ui/StatusBadge";
import type { Participant } from "../../participants/types";
import {
  balancedGroupSizes,
  groupMatchEstimate,
  knockoutMatchEstimate,
  recommendedGroupCount,
  roundRobinMatchCount,
  roundRobinRoundEstimate,
} from "../domain/estimates";
import {
  allHandsResultModes,
  competitionFormats,
  competitionIconKeys,
  competitionLimits,
  createCompetitionFormValues,
  defaultFormatConfig,
  defaultScoringConfig,
  firstTo,
  formatPresentation,
} from "../domain/config";
import { toFormValues } from "../domain/transforms";
import type {
  AllHandsConfig,
  AllHandsScoringConfig,
  CompetitionDraft,
  CompetitionFormat,
  CompetitionFormValues,
  CompetitionRecord,
  HeadToHeadScoringConfig,
  PublishedCompetition,
  SeriesConfig,
  ValidationIssue,
} from "../domain/types";
import {
  participantReferenceWarnings,
  validateCompetition,
} from "../domain/validation";

const steps = ["Basics", "Participants", "Format setup", "Scoring", "Review"];
const inputClass =
  "mt-2 min-h-11 w-full rounded-xl border border-white/15 bg-white/7 px-3 text-base text-white outline-none focus:border-[var(--color-electric-cyan-400)] focus:ring-3 focus:ring-[var(--color-electric-cyan-400)]/18 disabled:cursor-not-allowed disabled:opacity-50";
const labelClass = "block text-sm font-bold text-white";

function initials(name: string) {
  return name
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function NumberField({
  label,
  value,
  onChange,
  disabled,
  minimum = 0,
  maximum = competitionLimits.score,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  disabled?: boolean;
  minimum?: number;
  maximum?: number;
}) {
  return (
    <label className={labelClass}>
      {label}
      <input
        className={inputClass}
        disabled={disabled}
        inputMode="numeric"
        max={maximum}
        min={minimum}
        onChange={(event) => onChange(Number(event.target.value))}
        type="number"
        value={value}
      />
    </label>
  );
}

function SeriesFields({
  series,
  onChange,
}: {
  series: SeriesConfig;
  onChange: (series: SeriesConfig) => void;
}) {
  const value =
    series.kind === "single"
      ? "single"
      : series.kind === "best-of"
        ? `best-of-${series.maximumRounds}`
        : "first-to";
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <label className={labelClass}>
        Match series
        <select
          className={inputClass}
          onChange={(event) => {
            const selection = event.target.value;
            if (selection === "single") {
              onChange({ kind: "single", winsRequired: 1, maximumRounds: 1 });
            } else if (selection === "first-to") {
              onChange(firstTo(3));
            } else {
              const maximumRounds = Number(selection.at(-1)) as 3 | 5 | 7;
              onChange({
                kind: "best-of",
                maximumRounds,
                winsRequired: ((maximumRounds + 1) / 2) as 2 | 3 | 4,
              });
            }
          }}
          value={value}
        >
          <option value="single">Single round</option>
          <option value="best-of-3">Best of 3</option>
          <option value="best-of-5">Best of 5</option>
          <option value="best-of-7">Best of 7</option>
          <option value="first-to">First to N</option>
        </select>
      </label>
      {series.kind === "first-to" ? (
        <NumberField
          label="Wins required"
          maximum={competitionLimits.firstTo}
          minimum={1}
          onChange={(wins) => onChange(firstTo(wins))}
          value={series.winsRequired}
        />
      ) : (
        <div className="rounded-xl border border-white/10 bg-white/[0.035] p-4 text-sm leading-6 text-white/55">
          {series.kind === "single"
            ? "One decisive round."
            : `Best of ${series.maximumRounds} can finish ${series.winsRequired}–0 through ${series.winsRequired}–${series.winsRequired - 1}.`}
        </div>
      )}
    </div>
  );
}

function BasicsStep({
  values,
  setValues,
  onFormatRequest,
}: {
  values: CompetitionFormValues;
  setValues: React.Dispatch<React.SetStateAction<CompetitionFormValues>>;
  onFormatRequest: (format: CompetitionFormat) => void;
}) {
  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className={labelClass}>
          Competition title
          <input
            className={inputClass}
            maxLength={competitionLimits.title}
            onChange={(event) =>
              setValues((current) => ({
                ...current,
                title: event.target.value,
              }))
            }
            placeholder="Friday opener"
            value={values.title}
          />
        </label>
        <label className={labelClass}>
          Game name
          <input
            className={inputClass}
            maxLength={competitionLimits.gameName}
            onChange={(event) =>
              setValues((current) => ({
                ...current,
                gameName: event.target.value,
              }))
            }
            placeholder="Organizer enters the game"
            value={values.gameName}
          />
        </label>
      </div>
      <label className={labelClass}>
        Description{" "}
        <span className="font-normal text-white/45">(optional)</span>
        <textarea
          className={`${inputClass} min-h-24 py-3`}
          maxLength={competitionLimits.description}
          onChange={(event) =>
            setValues((current) => ({
              ...current,
              description: event.target.value,
            }))
          }
          value={values.description}
        />
        <span className="mt-1 block text-right text-xs text-white/40">
          {values.description.length}/{competitionLimits.description}
        </span>
      </label>
      <fieldset>
        <legend className="text-sm font-bold">Format</legend>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          {competitionFormats.map((format) => {
            const selected = values.format === format;
            const presentation = formatPresentation[format];
            return (
              <button
                aria-pressed={selected}
                className={`min-h-36 rounded-2xl border p-4 text-left transition focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-[var(--color-electric-cyan-400)] ${
                  selected
                    ? "border-[var(--color-electric-cyan-400)] bg-[var(--color-electric-cyan-400)]/10"
                    : "border-white/12 bg-white/[0.035] hover:border-white/25"
                }`}
                key={format}
                onClick={() => onFormatRequest(format)}
                type="button"
              >
                <ContentIcon
                  className="text-[var(--color-electric-cyan-400)]"
                  name={presentation.icon}
                  size={22}
                />
                <span className="mt-3 block font-extrabold">
                  {presentation.label}
                </span>
                <span className="mt-1 block text-xs leading-5 text-white/52">
                  {presentation.description}
                </span>
              </button>
            );
          })}
        </div>
      </fieldset>
      <fieldset>
        <legend className="text-sm font-bold">Icon</legend>
        <div className="mt-3 flex flex-wrap gap-2">
          {competitionIconKeys.map((icon) => (
            <button
              aria-label={`Use ${icon} icon`}
              aria-pressed={values.iconKey === icon}
              className={`flex size-12 items-center justify-center rounded-xl border focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-[var(--color-electric-cyan-400)] ${
                values.iconKey === icon
                  ? "border-[var(--color-electric-cyan-400)] bg-[var(--color-electric-cyan-400)]/12 text-[var(--color-electric-cyan-400)]"
                  : "border-white/12 bg-white/[0.035] text-white/60"
              }`}
              key={icon}
              onClick={() =>
                setValues((current) => ({ ...current, iconKey: icon }))
              }
              type="button"
            >
              <ContentIcon name={icon} size={21} />
            </button>
          ))}
        </div>
      </fieldset>
    </div>
  );
}

function ParticipantsStep({
  values,
  setValues,
  participants,
}: {
  values: CompetitionFormValues;
  setValues: React.Dispatch<React.SetStateAction<CompetitionFormValues>>;
  participants: Participant[];
}) {
  const visible = participants.filter(
    (participant) =>
      participant.status === "active" ||
      values.participantIds.includes(participant.id),
  );
  const activeIds = participants
    .filter((participant) => participant.status === "active")
    .map((participant) => participant.id);
  const withParticipantIds = (
    current: CompetitionFormValues,
    participantIds: string[],
  ): CompetitionFormValues => {
    const recommendation = recommendedGroupCount(participantIds.length);
    const formatConfig =
      current.formatConfig.kind === "group-knockout" &&
      current.formatConfig.groupCountMode === "automatic" &&
      recommendation
        ? { ...current.formatConfig, groupCount: recommendation }
        : current.formatConfig;
    return { ...current, participantIds, formatConfig };
  };
  const toggle = (id: string) =>
    setValues((current) =>
      withParticipantIds(
        current,
        current.participantIds.includes(id)
          ? current.participantIds.filter(
              (participantId) => participantId !== id,
            )
          : [...current.participantIds, id],
      ),
    );
  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-white/58">
          {values.participantIds.length} selected · IDs are stored, not names
        </p>
        <div className="flex gap-2">
          <Button
            onClick={() =>
              setValues((current) =>
                withParticipantIds(current, [
                  ...new Set([...current.participantIds, ...activeIds]),
                ]),
              )
            }
            variant="quiet"
          >
            Select all active
          </Button>
          <Button
            onClick={() =>
              setValues((current) => withParticipantIds(current, []))
            }
            variant="quiet"
          >
            Clear
          </Button>
        </div>
      </div>
      {visible.length === 0 ? (
        <p className="mt-5 rounded-2xl border border-dashed border-white/15 p-6 text-center text-sm text-white/55">
          Add active participants before publishing a competition.
        </p>
      ) : (
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          {visible.map((participant) => {
            const selected = values.participantIds.includes(participant.id);
            const unavailable = participant.status !== "active" && !selected;
            return (
              <label
                className={`flex min-h-16 items-center gap-3 rounded-2xl border p-3 ${
                  selected
                    ? "border-[var(--color-electric-cyan-400)] bg-[var(--color-electric-cyan-400)]/8"
                    : "border-white/10 bg-white/[0.035]"
                } ${unavailable ? "opacity-45" : "cursor-pointer"}`}
                key={participant.id}
              >
                <input
                  checked={selected}
                  className="size-5 accent-[var(--color-electric-cyan-400)]"
                  disabled={unavailable}
                  onChange={() => toggle(participant.id)}
                  type="checkbox"
                />
                <ParticipantAvatar
                  accent={participant.avatar.tone}
                  icon={participant.avatar.icon}
                  initials={initials(participant.displayName)}
                  name={participant.displayName}
                  size="sm"
                />
                <span className="min-w-0">
                  <span className="block truncate text-sm font-bold">
                    {participant.displayName}
                  </span>
                  <span className="block text-xs text-white/42">
                    …{participant.id.slice(-6)} · {participant.status}
                  </span>
                </span>
              </label>
            );
          })}
        </div>
      )}
    </div>
  );
}

function CheckboxField({
  checked,
  label,
  onChange,
}: {
  checked: boolean;
  label: string;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex min-h-12 items-center gap-3 rounded-xl border border-white/10 bg-white/[0.035] px-4 text-sm font-bold">
      <input
        checked={checked}
        className="size-5 accent-[var(--color-electric-cyan-400)]"
        onChange={(event) => onChange(event.target.checked)}
        type="checkbox"
      />
      {label}
    </label>
  );
}

function FormatStep({
  values,
  setValues,
}: {
  values: CompetitionFormValues;
  setValues: React.Dispatch<React.SetStateAction<CompetitionFormValues>>;
}) {
  const config = values.formatConfig;
  if (config.kind === "all-hands") {
    return (
      <div className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className={labelClass}>
            Result mode
            <select
              className={inputClass}
              onChange={(event) =>
                setValues((current) => ({
                  ...current,
                  formatConfig: {
                    ...(current.formatConfig as AllHandsConfig),
                    resultMode: event.target
                      .value as AllHandsConfig["resultMode"],
                  },
                }))
              }
              value={config.resultMode}
            >
              {allHandsResultModes.map((mode) => (
                <option key={mode} value={mode}>
                  {mode.replaceAll("-", " ")}
                </option>
              ))}
            </select>
          </label>
          <label className={labelClass}>
            Session plan
            <select
              className={inputClass}
              onChange={(event) =>
                setValues((current) => ({
                  ...current,
                  formatConfig: {
                    ...(current.formatConfig as AllHandsConfig),
                    sessionPlan:
                      event.target.value === "planned"
                        ? { kind: "planned", sessionCount: 3 }
                        : { kind: "open-ended" },
                  },
                }))
              }
              value={config.sessionPlan.kind}
            >
              <option value="open-ended">Open-ended sessions</option>
              <option value="planned">Planned number</option>
            </select>
          </label>
        </div>
        {config.sessionPlan.kind === "planned" ? (
          <NumberField
            label="Planned sessions"
            maximum={competitionLimits.sessions}
            minimum={1}
            onChange={(sessionCount) =>
              setValues((current) => ({
                ...current,
                formatConfig: {
                  ...(current.formatConfig as AllHandsConfig),
                  sessionPlan: { kind: "planned", sessionCount },
                },
              }))
            }
            value={config.sessionPlan.sessionCount}
          />
        ) : null}
        <CheckboxField
          checked={config.allowTeams}
          label="Allow team results in a later phase"
          onChange={(allowTeams) =>
            setValues((current) => ({
              ...current,
              formatConfig: {
                ...(current.formatConfig as AllHandsConfig),
                allowTeams,
              },
            }))
          }
        />
        <div className="grid gap-4 sm:grid-cols-2">
          {(["primaryMetricLabel", "secondaryMetricLabel"] as const).map(
            (field, index) => (
              <label className={labelClass} key={field}>
                {index === 0 ? "Primary" : "Secondary"} metric label
                <input
                  className={inputClass}
                  maxLength={competitionLimits.metricLabel}
                  onChange={(event) =>
                    setValues((current) => ({
                      ...current,
                      formatConfig: {
                        ...(current.formatConfig as AllHandsConfig),
                        [field]: event.target.value || null,
                      },
                    }))
                  }
                  placeholder={index === 0 ? "Score" : "Tiebreak"}
                  value={config[field] ?? ""}
                />
              </label>
            ),
          )}
        </div>
        <p className="rounded-xl border border-white/10 bg-white/[0.035] p-4 text-sm leading-6 text-white/55">
          Tied placements currently use the shared-points preference. Sessions
          and result entry are not created in this phase.
        </p>
      </div>
    );
  }

  const setHeadConfig = (next: Partial<typeof config>) =>
    setValues((current) => ({
      ...current,
      formatConfig: { ...current.formatConfig, ...next } as typeof config,
    }));
  const participantCount = values.participantIds.length;
  if (config.kind === "round-robin-knockout") {
    const rounds = roundRobinRoundEstimate(participantCount);
    return (
      <div className="space-y-5">
        <SeriesFields
          onChange={(series) => setHeadConfig({ series })}
          series={config.series}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <NumberField
            label="Number qualifying"
            maximum={Math.max(2, participantCount)}
            minimum={2}
            onChange={(qualificationCount) =>
              setHeadConfig({ qualificationCount })
            }
            value={config.qualificationCount}
          />
          <div className="space-y-3">
            <CheckboxField
              checked={config.allowDraws}
              label="Allow drawn matches"
              onChange={(allowDraws) => setHeadConfig({ allowDraws })}
            />
            <CheckboxField
              checked={config.includeThirdPlace}
              label="Include a third-place match later"
              onChange={(includeThirdPlace) =>
                setHeadConfig({ includeThirdPlace })
              }
            />
          </div>
        </div>
        <div className="rounded-2xl border border-[var(--color-electric-cyan-400)]/20 bg-[var(--color-electric-cyan-400)]/6 p-4 text-sm leading-6 text-white/62">
          <strong className="text-white">Configuration preview:</strong>{" "}
          {roundRobinMatchCount(participantCount)} initial-stage matches across
          about {rounds.rounds} fixture rounds, with {rounds.matchesPerRound}{" "}
          matches per round. {config.qualificationCount} qualify for about{" "}
          {knockoutMatchEstimate(
            config.qualificationCount,
            config.includeThirdPlace,
          )}{" "}
          knockout matches.
          {rounds.hasByes
            ? " An odd field means the future engine will rotate byes."
            : ""}
        </div>
      </div>
    );
  }

  const recommendation = recommendedGroupCount(participantCount);
  const effectiveGroupCount =
    config.groupCountMode === "automatic" && recommendation
      ? recommendation
      : config.groupCount;
  const groupSizes = balancedGroupSizes(participantCount, effectiveGroupCount);
  const qualifierCount = effectiveGroupCount * config.qualifiersPerGroup;
  return (
    <div className="space-y-5">
      <SeriesFields
        onChange={(series) => setHeadConfig({ series })}
        series={config.series}
      />
      <div className="grid gap-4 sm:grid-cols-3">
        <label className={labelClass}>
          Group-count mode
          <select
            className={inputClass}
            onChange={(event) => {
              const groupCountMode = event.target.value as
                "automatic" | "manual";
              setHeadConfig({
                groupCountMode,
                groupCount:
                  groupCountMode === "automatic" && recommendation
                    ? recommendation
                    : config.groupCount,
              });
            }}
            value={config.groupCountMode}
          >
            <option value="automatic">Automatic recommendation</option>
            <option value="manual">Manual</option>
          </select>
        </label>
        <NumberField
          disabled={config.groupCountMode === "automatic"}
          label="Groups"
          maximum={competitionLimits.groups}
          minimum={1}
          onChange={(groupCount) => setHeadConfig({ groupCount })}
          value={effectiveGroupCount}
        />
        <NumberField
          label="Qualifiers per group"
          maximum={competitionLimits.participants}
          minimum={1}
          onChange={(qualifiersPerGroup) =>
            setHeadConfig({ qualifiersPerGroup })
          }
          value={config.qualifiersPerGroup}
        />
      </div>
      <label className={labelClass}>
        Group round robin
        <select
          className={inputClass}
          onChange={(event) =>
            setHeadConfig({
              roundRobinLegs: Number(event.target.value) as 1 | 2,
            })
          }
          value={config.roundRobinLegs}
        >
          <option value={1}>Single round robin</option>
          <option value={2}>Double round robin</option>
        </select>
      </label>
      <div className="grid gap-3 sm:grid-cols-2">
        <CheckboxField
          checked={config.allowDraws}
          label="Allow drawn matches"
          onChange={(allowDraws) => setHeadConfig({ allowDraws })}
        />
        <CheckboxField
          checked={config.includeThirdPlace}
          label="Include a third-place match later"
          onChange={(includeThirdPlace) => setHeadConfig({ includeThirdPlace })}
        />
      </div>
      <div className="rounded-2xl border border-[var(--color-electric-cyan-400)]/20 bg-[var(--color-electric-cyan-400)]/6 p-4 text-sm leading-6 text-white/62">
        <strong className="text-white">Configuration preview:</strong>{" "}
        {groupSizes.length
          ? `Expected group sizes ${groupSizes.join(" / ")}, ${groupMatchEstimate(groupSizes, config.roundRobinLegs)} group-stage matches, ${qualifierCount} qualifiers and ${knockoutMatchEstimate(qualifierCount, config.includeThirdPlace)} knockout matches.`
          : "Select enough participants to estimate balanced groups."}
        {new Set(groupSizes).size > 1
          ? " Group sizes are uneven by one, so later seeding may need care."
          : ""}
      </div>
    </div>
  );
}

function ScoringStep({
  values,
  setValues,
}: {
  values: CompetitionFormValues;
  setValues: React.Dispatch<React.SetStateAction<CompetitionFormValues>>;
}) {
  const scoring = values.scoringConfig;
  if (scoring.kind === "all-hands") {
    const setAllHands = (next: Partial<AllHandsScoringConfig>) =>
      setValues((current) => ({
        ...current,
        scoringConfig: {
          ...(current.scoringConfig as AllHandsScoringConfig),
          ...next,
        },
      }));
    return (
      <div className="space-y-6">
        <div>
          <h3 className="text-lg font-extrabold">
            Overall championship awards
          </h3>
          <p className="mt-1 text-sm text-white/52">
            These values will create ledger entries only in a later phase.
          </p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <NumberField
              label="Winner bonus"
              onChange={(winnerBonus) => setAllHands({ winnerBonus })}
              value={scoring.winnerBonus}
            />
            <NumberField
              label="Participation points"
              onChange={(participationPoints) =>
                setAllHands({ participationPoints })
              }
              value={scoring.participationPoints}
            />
          </div>
        </div>
        <div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-lg font-extrabold">Placement points</h3>
              <p className="mt-1 text-sm text-white/52">
                First place stays first; warnings never rewrite your values.
              </p>
            </div>
            <Button
              disabled={
                scoring.placementPoints.length >=
                  values.participantIds.length ||
                scoring.placementPoints.length >= competitionLimits.participants
              }
              onClick={() =>
                setAllHands({
                  placementPoints: [
                    ...scoring.placementPoints,
                    { place: scoring.placementPoints.length + 1, points: 0 },
                  ],
                })
              }
              variant="quiet"
            >
              Add placement
            </Button>
          </div>
          <div className="mt-4 space-y-3">
            {scoring.placementPoints.map((award, index) => (
              <div
                className="grid grid-cols-[1fr_1fr_auto] items-end gap-3 rounded-xl border border-white/10 bg-white/[0.035] p-3"
                key={award.place}
              >
                <NumberField
                  label="Place"
                  maximum={competitionLimits.participants}
                  minimum={1}
                  onChange={(place) =>
                    setAllHands({
                      placementPoints: scoring.placementPoints.map((item, i) =>
                        i === index ? { ...item, place } : item,
                      ),
                    })
                  }
                  value={award.place}
                />
                <NumberField
                  label="Points"
                  onChange={(points) =>
                    setAllHands({
                      placementPoints: scoring.placementPoints.map((item, i) =>
                        i === index ? { ...item, points } : item,
                      ),
                    })
                  }
                  value={award.points}
                />
                <Button
                  aria-label={`Remove place ${award.place}`}
                  onClick={() =>
                    setAllHands({
                      placementPoints: scoring.placementPoints.filter(
                        (_, i) => i !== index,
                      ),
                    })
                  }
                  variant="quiet"
                >
                  Remove
                </Button>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const config = values.formatConfig;
  const allowDraws = config.kind !== "all-hands" ? config.allowDraws : false;
  const setScoring = (next: HeadToHeadScoringConfig) =>
    setValues((current) => ({ ...current, scoringConfig: next }));
  const tableField = (
    key: keyof HeadToHeadScoringConfig["table"],
    value: number,
  ) => setScoring({ ...scoring, table: { ...scoring.table, [key]: value } });
  const overallField = (
    key: keyof HeadToHeadScoringConfig["overall"],
    value: number,
  ) =>
    setScoring({ ...scoring, overall: { ...scoring.overall, [key]: value } });
  return (
    <div className="space-y-7">
      <section aria-labelledby="table-scoring-title">
        <h3 className="text-lg font-extrabold" id="table-scoring-title">
          Competition ranking points
        </h3>
        <p className="mt-1 text-sm text-white/52">
          These rank the initial stage only. They are not weekend points.
        </p>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <NumberField
            label="Match win"
            onChange={(value) => tableField("pointsForMatchWin", value)}
            value={scoring.table.pointsForMatchWin}
          />
          <NumberField
            disabled={!allowDraws}
            label="Draw"
            onChange={(value) => tableField("pointsForDraw", value)}
            value={scoring.table.pointsForDraw}
          />
          <NumberField
            label="Match loss"
            onChange={(value) => tableField("pointsForMatchLoss", value)}
            value={scoring.table.pointsForMatchLoss}
          />
        </div>
      </section>
      <section aria-labelledby="championship-scoring-title">
        <h3 className="text-lg font-extrabold" id="championship-scoring-title">
          Overall championship points
        </h3>
        <p className="mt-1 text-sm text-white/52">
          These become explainable weekend ledger entries in a later phase.
        </p>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <NumberField
            label="Match-win bonus"
            onChange={(value) => overallField("matchWinBonus", value)}
            value={scoring.overall.matchWinBonus}
          />
          <NumberField
            label="Per round won"
            onChange={(value) => overallField("pointsPerRoundWon", value)}
            value={scoring.overall.pointsPerRoundWon}
          />
          <NumberField
            label="Participation"
            onChange={(value) => overallField("participationPoints", value)}
            value={scoring.overall.participationPoints}
          />
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {(
            [
              ["qualificationBonus", "Qualification bonus"],
              ["competitionWinnerBonus", "Winner bonus"],
              ["runnerUpBonus", "Runner-up bonus"],
              ["thirdPlaceBonus", "Third-place bonus"],
            ] as const
          ).map(([key, label]) => (
            <NumberField
              key={key}
              label={label}
              onChange={(value) => overallField(key, value)}
              value={scoring.overall[key]}
            />
          ))}
        </div>
      </section>
      <div className="rounded-2xl border border-[var(--color-antique-gold-400)]/25 bg-[var(--color-antique-gold-400)]/7 p-4 text-sm leading-6 text-white/65">
        <strong className="text-white">Example preview:</strong> a 2–1 winner
        would receive {scoring.overall.matchWinBonus} match-win points +{" "}
        {2 * scoring.overall.pointsPerRoundWon} round-win points ={" "}
        {scoring.overall.matchWinBonus + 2 * scoring.overall.pointsPerRoundWon}.
        The other player would receive {scoring.overall.pointsPerRoundWon}{" "}
        round-win point{scoring.overall.pointsPerRoundWon === 1 ? "" : "s"}.
      </div>
    </div>
  );
}

function ReviewStep({
  values,
  issues,
  participants,
  onGoToStep,
}: {
  values: CompetitionFormValues;
  issues: ValidationIssue[];
  participants: Participant[];
  onGoToStep: (step: number) => void;
}) {
  const selected = values.participantIds.map(
    (id) =>
      participants.find((participant) => participant.id === id)?.displayName ??
      "Unavailable participant",
  );
  const stepForField = (field: string) => {
    if (field.startsWith("participant")) return 1;
    if (field.startsWith("formatConfig")) return 2;
    if (field.startsWith("scoringConfig")) return 3;
    return 0;
  };
  return (
    <div className="space-y-6">
      {issues.length > 0 ? (
        <div className="rounded-2xl border border-[var(--color-warning-500)]/30 bg-[var(--color-warning-500)]/8 p-4">
          <h3 className="flex items-center gap-2 font-extrabold text-[var(--color-warning-500)]">
            <AlertTriangle aria-hidden="true" size={18} />
            Review {issues.length} validation note
            {issues.length === 1 ? "" : "s"}
          </h3>
          <ul className="mt-3 space-y-2 text-sm">
            {issues.map((validationIssue, index) => (
              <li key={`${validationIssue.field}-${index}`}>
                <button
                  className="text-left text-white/72 underline decoration-white/25 underline-offset-3 hover:text-white"
                  onClick={() =>
                    onGoToStep(stepForField(validationIssue.field))
                  }
                  type="button"
                >
                  {validationIssue.severity === "warning" ? "Warning: " : ""}
                  {validationIssue.message}
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p
          className="flex items-center gap-2 rounded-2xl border border-[var(--color-success-500)]/30 bg-[var(--color-success-500)]/8 p-4 text-sm text-[var(--color-success-500)]"
          role="status"
        >
          <Check aria-hidden="true" size={18} />
          Configuration is ready to publish.
        </p>
      )}
      <article className="rounded-2xl border border-white/12 bg-white/[0.045] p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-bold tracking-[0.14em] text-[var(--color-antique-gold-400)] uppercase">
              {formatPresentation[values.format].label}
            </p>
            <h3 className="mt-2 text-2xl font-extrabold">
              {values.title || "Untitled draft"}
            </h3>
            <p className="mt-1 text-sm text-white/58">
              {values.gameName || "Game name not set"}
            </p>
          </div>
          <ContentIcon name={values.iconKey} size={26} />
        </div>
        {values.description ? (
          <p className="mt-4 text-sm leading-6 text-white/55">
            {values.description}
          </p>
        ) : null}
        <dl className="mt-5 grid gap-4 border-t border-white/8 pt-4 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-white/42">Participants</dt>
            <dd className="mt-1 font-bold text-white">
              {selected.length ? selected.join(", ") : "None selected"}
            </dd>
          </div>
          <div>
            <dt className="text-white/42">Status after publishing</dt>
            <dd className="mt-1 font-bold text-white">
              Scheduled · no fixed time
            </dd>
          </div>
        </dl>
      </article>
      <div className="rounded-2xl border border-white/10 bg-black/15 p-4 text-sm leading-6 text-white/58">
        <p className="font-bold text-white">
          Publishing makes this competition visible to the group.
        </p>
        <p>Fixtures and results are not generated yet.</p>
      </div>
    </div>
  );
}

type Confirmation = "discard" | "format" | "publish" | "scheduled" | null;

export function CompetitionWizard({
  record,
  latestRecord,
  participants,
  canMutate,
  onCancel,
  onSaveDraft,
  onPublish,
  onSaveScheduled,
}: {
  record: CompetitionDraft | PublishedCompetition | null;
  latestRecord: CompetitionRecord | null;
  participants: Participant[];
  canMutate: boolean;
  onCancel: () => void;
  onSaveDraft: (
    record: CompetitionDraft | null,
    values: CompetitionFormValues,
  ) => Promise<void>;
  onPublish: (
    record: CompetitionDraft | null,
    values: CompetitionFormValues,
  ) => Promise<void>;
  onSaveScheduled: (
    record: PublishedCompetition,
    values: CompetitionFormValues,
  ) => Promise<void>;
}) {
  const reduceMotion = useReducedMotion();
  const [step, setStep] = useState(0);
  const [values, setValues] = useState<CompetitionFormValues>(() =>
    record ? toFormValues(record) : createCompetitionFormValues(),
  );
  const [baseline, setBaseline] = useState(() => JSON.stringify(values));
  const [baselineRevision, setBaselineRevision] = useState(
    record?.revision ?? 0,
  );
  const [pendingFormat, setPendingFormat] = useState<CompetitionFormat | null>(
    null,
  );
  const [confirmation, setConfirmation] = useState<Confirmation>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dirty = JSON.stringify(values) !== baseline;
  const workingRecord =
    latestRecord?.revision === baselineRevision ? latestRecord : record;
  const remoteChanged = Boolean(
    record &&
    latestRecord &&
    latestRecord.id === record.id &&
    latestRecord.revision !== baselineRevision,
  );
  const issues = useMemo(
    () => validateCompetition(values, "publish"),
    [values],
  );
  const referenceWarnings = useMemo(
    () => participantReferenceWarnings(values.participantIds, participants),
    [participants, values.participantIds],
  );
  const allIssues = useMemo(
    () => [
      ...issues,
      ...referenceWarnings.map((warning) => ({
        field: "participantIds",
        message: warning.message,
        severity: "warning" as const,
      })),
    ],
    [issues, referenceWarnings],
  );
  const hasPublishErrors = allIssues.some((item) => item.severity === "error");

  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const applyFormat = (format: CompetitionFormat) => {
    setValues((current) => {
      const formatConfig = defaultFormatConfig(format);
      const recommendation = recommendedGroupCount(
        current.participantIds.length,
      );
      return {
        ...current,
        format,
        iconKey: formatPresentation[format].icon,
        formatConfig:
          formatConfig.kind === "group-knockout" && recommendation
            ? { ...formatConfig, groupCount: recommendation }
            : formatConfig,
        scoringConfig: defaultScoringConfig(format),
      };
    });
    setPendingFormat(null);
  };

  const run = async (action: () => Promise<void>) => {
    if (submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      await action();
      setBaseline(JSON.stringify(values));
      onCancel();
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "The competition could not be saved.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const save = () => {
    if (workingRecord?.status === "scheduled") {
      const original = toFormValues(workingRecord);
      const consequential =
        original.format !== values.format ||
        JSON.stringify(original.participantIds) !==
          JSON.stringify(values.participantIds) ||
        JSON.stringify(original.scoringConfig) !==
          JSON.stringify(values.scoringConfig);
      if (consequential) {
        setConfirmation("scheduled");
        return;
      }
      void run(() => onSaveScheduled(workingRecord, values));
      return;
    }
    void run(() =>
      onSaveDraft(
        workingRecord?.status === "draft" ? workingRecord : null,
        values,
      ),
    );
  };

  const requestCancel = () => {
    if (dirty) setConfirmation("discard");
    else onCancel();
  };

  let stepContent: ReactNode;
  if (step === 0) {
    stepContent = (
      <BasicsStep
        onFormatRequest={(format) => {
          if (format === values.format) return;
          setPendingFormat(format);
          setConfirmation("format");
        }}
        setValues={setValues}
        values={values}
      />
    );
  } else if (step === 1) {
    stepContent = (
      <ParticipantsStep
        participants={participants}
        setValues={setValues}
        values={values}
      />
    );
  } else if (step === 2) {
    stepContent = <FormatStep setValues={setValues} values={values} />;
  } else if (step === 3) {
    stepContent = <ScoringStep setValues={setValues} values={values} />;
  } else {
    stepContent = (
      <ReviewStep
        issues={allIssues}
        onGoToStep={setStep}
        participants={participants}
        values={values}
      />
    );
  }

  const confirmContent = {
    discard: {
      title: "Discard unsaved changes?",
      description: "The form has changes that have not been saved to Firebase.",
      action: "Discard changes",
    },
    format: {
      title: "Change competition format?",
      description:
        "Incompatible format and scoring settings will reset. Basics and participant selection stay in place.",
      action: "Change format",
    },
    publish: {
      title: "Publish this competition?",
      description:
        "It will become visible to the group as scheduled. No fixtures, sessions, results or points will be created.",
      action: "Publish competition",
    },
    scheduled: {
      title: "Update consequential settings?",
      description:
        "The format, participant selection or scoring changed. There is no generated play state yet, but connected guests will see the new configuration.",
      action: "Save scheduled changes",
    },
  } as const;

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <StatusBadge
            tone={workingRecord?.status === "scheduled" ? "live" : "gold"}
          >
            {workingRecord?.status === "scheduled"
              ? "Editing scheduled"
              : "Private draft"}
          </StatusBadge>
          <p className="mt-2 text-xs text-white/45">
            {record ? `Revision ${baselineRevision}` : "Not saved yet"}
          </p>
        </div>
        <Button onClick={requestCancel} variant="quiet">
          Close wizard
        </Button>
      </div>

      <nav
        aria-label="Competition wizard steps"
        className="mt-6 overflow-x-auto pb-2"
      >
        <ol className="flex min-w-max gap-2">
          {steps.map((label, index) => (
            <li key={label}>
              <button
                aria-current={step === index ? "step" : undefined}
                className={`min-h-11 rounded-full border px-4 text-sm font-bold focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-[var(--color-electric-cyan-400)] ${
                  step === index
                    ? "border-[var(--color-electric-cyan-400)] bg-[var(--color-electric-cyan-400)]/12 text-[var(--color-electric-cyan-400)]"
                    : "border-white/10 text-white/55 hover:text-white"
                }`}
                onClick={() => setStep(index)}
                type="button"
              >
                {index + 1}. {label}
              </button>
            </li>
          ))}
        </ol>
      </nav>

      {remoteChanged ? (
        <div
          className="mt-5 rounded-2xl border border-[var(--color-warning-500)]/30 bg-[var(--color-warning-500)]/8 p-4"
          role="alert"
        >
          <p className="flex items-center gap-2 font-bold text-[var(--color-warning-500)]">
            <AlertTriangle aria-hidden="true" size={18} />
            This competition changed on another device.
          </p>
          <p className="mt-1 text-sm text-white/60">
            {dirty
              ? "Your unsaved form was preserved. Reload the latest version before saving."
              : "Reload the latest version before making or saving changes."}
          </p>
          <Button
            className="mt-3"
            onClick={() => {
              if (!latestRecord) return;
              if (latestRecord.status === "archived") {
                onCancel();
                return;
              }
              const next = toFormValues(latestRecord);
              setValues(next);
              setBaseline(JSON.stringify(next));
              setBaselineRevision(latestRecord.revision);
            }}
            variant="quiet"
          >
            Discard local changes and reload
          </Button>
        </div>
      ) : null}

      {error ? (
        <p
          className="mt-5 rounded-2xl border border-[#ff9ca1]/25 bg-[#ff9ca1]/8 p-4 text-sm text-[#ffc3c6]"
          role="alert"
        >
          {error}
        </p>
      ) : null}

      <motion.div
        animate={{ opacity: 1, x: 0 }}
        className="mt-6"
        initial={reduceMotion ? false : { opacity: 0, x: 10 }}
        key={step}
        transition={{ duration: reduceMotion ? 0 : 0.18 }}
      >
        <h2 className="sr-only" tabIndex={-1}>
          Step {step + 1}: {steps[step]}
        </h2>
        {stepContent}
      </motion.div>

      <div className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-5">
        <Button
          disabled={step === 0}
          onClick={() => setStep((current) => Math.max(0, current - 1))}
          variant="quiet"
        >
          <ChevronLeft aria-hidden="true" size={17} />
          Previous
        </Button>
        <div className="flex flex-wrap justify-end gap-2">
          {workingRecord?.status !== "scheduled" ? (
            <Button
              disabled={!canMutate || submitting || remoteChanged}
              onClick={save}
              variant="quiet"
            >
              <Save aria-hidden="true" size={17} />
              Save draft
            </Button>
          ) : null}
          {step < steps.length - 1 ? (
            <Button
              onClick={() => setStep((current) => current + 1)}
              variant="dark"
            >
              Next
              <ChevronRight aria-hidden="true" size={17} />
            </Button>
          ) : workingRecord?.status === "scheduled" ? (
            <Button
              disabled={
                !canMutate || submitting || remoteChanged || hasPublishErrors
              }
              onClick={save}
              variant="dark"
            >
              {submitting ? "Saving…" : "Save scheduled competition"}
            </Button>
          ) : (
            <Button
              disabled={
                !canMutate || submitting || remoteChanged || hasPublishErrors
              }
              onClick={() => setConfirmation("publish")}
              variant="dark"
            >
              <Send aria-hidden="true" size={17} />
              Publish competition
            </Button>
          )}
        </div>
      </div>
      {!canMutate ? (
        <p className="mt-3 flex items-center gap-2 text-xs text-white/45">
          <CircleHelp aria-hidden="true" size={15} />
          Mutations are available only while organizer access is online.
        </p>
      ) : null}

      <Modal
        description={
          confirmation ? confirmContent[confirmation].description : undefined
        }
        onClose={() => {
          setConfirmation(null);
          setPendingFormat(null);
        }}
        open={confirmation !== null}
        title={confirmation ? confirmContent[confirmation].title : "Confirm"}
      >
        <div className="flex flex-wrap justify-end gap-3">
          <Button
            onClick={() => {
              setConfirmation(null);
              setPendingFormat(null);
            }}
            variant="quiet"
          >
            Keep editing
          </Button>
          <Button
            disabled={submitting}
            onClick={() => {
              const action = confirmation;
              setConfirmation(null);
              if (action === "discard") onCancel();
              else if (action === "format" && pendingFormat)
                applyFormat(pendingFormat);
              else if (action === "publish") {
                void run(() =>
                  onPublish(
                    workingRecord?.status === "draft" ? workingRecord : null,
                    values,
                  ),
                );
              } else if (
                action === "scheduled" &&
                workingRecord?.status === "scheduled"
              ) {
                void run(() => onSaveScheduled(workingRecord, values));
              }
            }}
            variant="dark"
          >
            {confirmation ? confirmContent[confirmation].action : "Confirm"}
          </Button>
        </div>
      </Modal>
    </div>
  );
}

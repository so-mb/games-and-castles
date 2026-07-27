import {
  allHandsResultModes,
  competitionFormats,
  competitionIconKeys,
  competitionLimits,
} from "./config";
import type {
  AllHandsConfig,
  AllHandsScoringConfig,
  CompetitionDraft,
  CompetitionFormValues,
  CompetitionRecord,
  FormatConfig,
  HeadToHeadScoringConfig,
  PublishedCompetition,
  ScoringConfig,
  SeriesConfig,
} from "./types";
import { recommendedGroupCount } from "./estimates";
import { validateCompetition } from "./validation";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasExactKeys(
  value: Record<string, unknown>,
  required: string[],
  optional: string[] = [],
) {
  const keys = Object.keys(value);
  return (
    required.every((key) => keys.includes(key)) &&
    keys.every((key) => required.includes(key) || optional.includes(key))
  );
}

function isString(value: unknown, maximum = 128) {
  return typeof value === "string" && value.length <= maximum;
}

function isInteger(value: unknown, minimum: number, maximum: number) {
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    Number.isInteger(value) &&
    value >= minimum &&
    value <= maximum
  );
}

function parseSeries(value: unknown): SeriesConfig | null {
  if (!isRecord(value) || typeof value.kind !== "string") return null;
  if (value.kind === "single") {
    return hasExactKeys(value, ["kind", "winsRequired", "maximumRounds"]) &&
      value.winsRequired === 1 &&
      value.maximumRounds === 1
      ? { kind: "single", winsRequired: 1, maximumRounds: 1 }
      : null;
  }
  if (value.kind === "best-of") {
    if (
      !hasExactKeys(value, ["kind", "winsRequired", "maximumRounds"]) ||
      ![3, 5, 7].includes(Number(value.maximumRounds)) ||
      Number(value.winsRequired) !== (Number(value.maximumRounds) + 1) / 2
    ) {
      return null;
    }
    return value as unknown as SeriesConfig;
  }
  if (
    value.kind !== "first-to" ||
    !hasExactKeys(value, ["kind", "winsRequired", "maximumRounds"]) ||
    !isInteger(value.winsRequired, 1, competitionLimits.firstTo) ||
    Number(value.maximumRounds) !== Number(value.winsRequired) * 2 - 1
  ) {
    return null;
  }
  return value as unknown as SeriesConfig;
}

function parseFormatConfig(value: unknown): FormatConfig | null {
  if (!isRecord(value) || typeof value.kind !== "string") return null;
  if (value.kind === "round-robin-knockout") {
    const series = parseSeries(value.series);
    if (
      !hasExactKeys(value, [
        "kind",
        "series",
        "allowDraws",
        "qualificationCount",
        "includeThirdPlace",
      ]) ||
      !series ||
      typeof value.allowDraws !== "boolean" ||
      !isInteger(value.qualificationCount, 0, competitionLimits.participants) ||
      typeof value.includeThirdPlace !== "boolean"
    ) {
      return null;
    }
    return { ...value, series } as unknown as FormatConfig;
  }
  if (value.kind === "group-knockout") {
    const series = parseSeries(value.series);
    if (
      !hasExactKeys(value, [
        "kind",
        "groupCountMode",
        "groupCount",
        "qualifiersPerGroup",
        "roundRobinLegs",
        "series",
        "allowDraws",
        "includeThirdPlace",
      ]) ||
      !["automatic", "manual"].includes(String(value.groupCountMode)) ||
      !isInteger(value.groupCount, 1, competitionLimits.groups) ||
      !isInteger(value.qualifiersPerGroup, 1, competitionLimits.participants) ||
      ![1, 2].includes(Number(value.roundRobinLegs)) ||
      !series ||
      typeof value.allowDraws !== "boolean" ||
      typeof value.includeThirdPlace !== "boolean"
    ) {
      return null;
    }
    return { ...value, series } as unknown as FormatConfig;
  }
  if (value.kind !== "all-hands") return null;
  if (
    !hasExactKeys(
      value,
      ["kind", "resultMode", "sessionPlan", "allowTeams", "tieHandling"],
      [
        "primaryMetricLabel",
        "primaryMetricDirection",
        "secondaryMetricLabel",
        "secondaryMetricDirection",
        "allowNegativeScores",
      ],
    ) ||
    !allHandsResultModes.includes(
      value.resultMode as (typeof allHandsResultModes)[number],
    ) ||
    !isRecord(value.sessionPlan) ||
    typeof value.allowTeams !== "boolean" ||
    !["shared", "shared-placement", "manual-order"].includes(
      String(value.tieHandling),
    ) ||
    (value.primaryMetricDirection !== undefined &&
      !["higher", "lower"].includes(String(value.primaryMetricDirection))) ||
    (value.secondaryMetricDirection !== undefined &&
      value.secondaryMetricDirection !== null &&
      !["higher", "lower"].includes(String(value.secondaryMetricDirection))) ||
    (value.allowNegativeScores !== undefined &&
      typeof value.allowNegativeScores !== "boolean")
  ) {
    return null;
  }
  const plan = value.sessionPlan;
  if (
    (plan.kind === "open-ended" && !hasExactKeys(plan, ["kind"])) ||
    (plan.kind === "planned" &&
      (!hasExactKeys(plan, ["kind", "sessionCount"]) ||
        !isInteger(plan.sessionCount, 1, competitionLimits.sessions))) ||
    !["open-ended", "planned"].includes(String(plan.kind))
  ) {
    return null;
  }
  for (const label of [value.primaryMetricLabel, value.secondaryMetricLabel]) {
    if (
      label !== undefined &&
      (typeof label !== "string" ||
        !isString(label, competitionLimits.metricLabel) ||
        label.length < 2)
    ) {
      return null;
    }
  }
  return {
    ...value,
    primaryMetricLabel:
      typeof value.primaryMetricLabel === "string"
        ? value.primaryMetricLabel
        : null,
    secondaryMetricLabel:
      typeof value.secondaryMetricLabel === "string"
        ? value.secondaryMetricLabel
        : null,
    primaryMetricDirection:
      value.primaryMetricDirection === "lower"
        ? "lower"
        : value.primaryMetricDirection === "higher"
          ? "higher"
          : value.resultMode === "lowest-score"
            ? "lower"
            : "higher",
    secondaryMetricDirection:
      typeof value.secondaryMetricLabel === "string"
        ? value.secondaryMetricDirection === "higher"
          ? "higher"
          : "lower"
        : null,
    allowNegativeScores: value.allowNegativeScores === true,
    tieHandling:
      value.tieHandling === "manual-order"
        ? "manual-order"
        : "shared-placement",
  } as AllHandsConfig;
}

function parseScoringConfig(value: unknown): ScoringConfig | null {
  if (!isRecord(value) || typeof value.kind !== "string") return null;
  if (value.kind === "head-to-head") {
    if (
      !hasExactKeys(value, ["kind", "table", "overall"]) ||
      !isRecord(value.table) ||
      !isRecord(value.overall) ||
      !hasExactKeys(value.table, [
        "pointsForMatchWin",
        "pointsForDraw",
        "pointsForMatchLoss",
      ]) ||
      !hasExactKeys(value.overall, [
        "matchWinBonus",
        "pointsPerRoundWon",
        "participationPoints",
        "qualificationBonus",
        "competitionWinnerBonus",
        "runnerUpBonus",
        "thirdPlaceBonus",
      ]) ||
      [...Object.values(value.table), ...Object.values(value.overall)].some(
        (score) => !isInteger(score, 0, competitionLimits.score),
      )
    ) {
      return null;
    }
    return value as unknown as HeadToHeadScoringConfig;
  }
  if (
    value.kind !== "all-hands" ||
    !hasExactKeys(
      value,
      ["kind", "winnerBonus", "participationPoints"],
      ["placementPoints"],
    ) ||
    !isInteger(value.winnerBonus, 0, competitionLimits.score) ||
    !isInteger(value.participationPoints, 0, competitionLimits.score) ||
    (value.placementPoints !== undefined &&
      !Array.isArray(value.placementPoints))
  ) {
    return null;
  }
  const placementPoints = value.placementPoints ?? [];
  if (placementPoints.length > competitionLimits.participants) return null;
  const places = new Set<number>();
  for (const award of placementPoints) {
    if (
      !isRecord(award) ||
      !hasExactKeys(award, ["place", "points"]) ||
      !isInteger(award.place, 1, competitionLimits.participants) ||
      !isInteger(award.points, 0, competitionLimits.score) ||
      places.has(Number(award.place))
    ) {
      return null;
    }
    places.add(Number(award.place));
  }
  return { ...value, placementPoints } as unknown as AllHandsScoringConfig;
}

export function parseCompetitionRecord(
  value: unknown,
): CompetitionRecord | null {
  if (!isRecord(value)) return null;
  const published = ["scheduled", "active", "completed", "archived"].includes(
    String(value.status),
  );
  const required = [
    "id",
    "title",
    "gameName",
    "iconKey",
    "format",
    "formatConfig",
    "scoringConfig",
    "displayOrder",
    "createdAt",
    "updatedAt",
    "createdByUid",
    "updatedByUid",
    "revision",
    "schemaVersion",
    "status",
    ...(published ? ["participantIds", "publishedAt", "publishedByUid"] : []),
  ];
  if (
    !hasExactKeys(
      value,
      required,
      published ? ["description"] : ["description", "participantIds"],
    )
  ) {
    return null;
  }
  const participantIds = value.participantIds ?? [];
  if (
    !isString(value.id) ||
    !value.id ||
    !isString(value.title, competitionLimits.title) ||
    !isString(value.gameName, competitionLimits.gameName) ||
    (value.description !== undefined &&
      !isString(value.description, competitionLimits.description)) ||
    !competitionIconKeys.includes(
      value.iconKey as (typeof competitionIconKeys)[number],
    ) ||
    !competitionFormats.includes(
      value.format as (typeof competitionFormats)[number],
    ) ||
    !Array.isArray(participantIds) ||
    participantIds.some(
      (id) => !isString(id, competitionLimits.participantId) || !id,
    ) ||
    new Set(participantIds).size !== participantIds.length ||
    !isInteger(value.displayOrder, 0, 1_000_000) ||
    !isInteger(value.createdAt, 0, Number.MAX_SAFE_INTEGER) ||
    !isInteger(value.updatedAt, 0, Number.MAX_SAFE_INTEGER) ||
    !isString(value.createdByUid) ||
    !value.createdByUid ||
    !isString(value.updatedByUid) ||
    !value.updatedByUid ||
    !isInteger(value.revision, 1, Number.MAX_SAFE_INTEGER) ||
    value.schemaVersion !== 1 ||
    !["draft", "scheduled", "active", "completed", "archived"].includes(
      String(value.status),
    )
  ) {
    return null;
  }
  if (
    published &&
    (!isInteger(value.publishedAt, 0, Number.MAX_SAFE_INTEGER) ||
      !isString(value.publishedByUid) ||
      !value.publishedByUid ||
      Number(value.revision) < 2)
  ) {
    return null;
  }
  const formatConfig = parseFormatConfig(value.formatConfig);
  const scoringConfig = parseScoringConfig(value.scoringConfig);
  if (!formatConfig || !scoringConfig || formatConfig.kind !== value.format) {
    return null;
  }
  if (
    formatConfig.kind === "group-knockout" &&
    formatConfig.groupCountMode === "automatic"
  ) {
    const recommendation = recommendedGroupCount(participantIds.length);
    if (recommendation !== null && formatConfig.groupCount !== recommendation) {
      return null;
    }
  }
  const formValues: CompetitionFormValues = {
    title: value.title as string,
    gameName: value.gameName as string,
    description: typeof value.description === "string" ? value.description : "",
    iconKey: value.iconKey as CompetitionFormValues["iconKey"],
    format: value.format as CompetitionFormValues["format"],
    participantIds: participantIds as string[],
    formatConfig,
    scoringConfig,
  };
  if (
    validateCompetition(formValues, published ? "publish" : "draft").some(
      (validationIssue) => validationIssue.severity === "error",
    )
  ) {
    return null;
  }
  const common = {
    ...formValues,
    id: value.id as string,
    displayOrder: value.displayOrder as number,
    createdAt: value.createdAt as number,
    updatedAt: value.updatedAt as number,
    createdByUid: value.createdByUid as string,
    updatedByUid: value.updatedByUid as string,
    revision: value.revision as number,
    schemaVersion: 1 as const,
  };
  if (published) {
    return {
      ...common,
      status: value.status as PublishedCompetition["status"],
      publishedAt: value.publishedAt as number,
      publishedByUid: value.publishedByUid as string,
    };
  }
  return { ...common, status: "draft" } satisfies CompetitionDraft;
}

export function parseCompetitionCollection(value: unknown) {
  if (value === null || value === undefined) {
    return { records: [] as CompetitionRecord[], invalidIds: [] as string[] };
  }
  if (!isRecord(value)) {
    return { records: [] as CompetitionRecord[], invalidIds: ["collection"] };
  }
  const records: CompetitionRecord[] = [];
  const invalidIds: string[] = [];
  Object.entries(value).forEach(([id, raw]) => {
    const record = parseCompetitionRecord(raw);
    if (!record || record.id !== id) invalidIds.push(id);
    else records.push(record);
  });
  return { records, invalidIds };
}

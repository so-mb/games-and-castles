import {
  allHandsResultModes,
  competitionIconKeys,
  competitionLimits,
  formatPresentation,
} from "./config";
import type {
  CompetitionFormValues,
  ParticipantReference,
  ParticipantReferenceWarning,
  SeriesConfig,
  ValidationIssue,
} from "./types";
import { recommendedGroupCount } from "./estimates";

const plainTextPattern = /^[^<>]*$/;

function isPlainText(value: string) {
  return (
    plainTextPattern.test(value) &&
    !Array.from(value).some((character) => {
      const code = character.charCodeAt(0);
      return code < 32 || code === 127;
    })
  );
}

function issue(
  field: string,
  message: string,
  severity: ValidationIssue["severity"] = "error",
): ValidationIssue {
  return { field, message, severity };
}

function validateText(
  value: string,
  field: string,
  label: string,
  maximum: number,
  required: boolean,
) {
  const issues: ValidationIssue[] = [];
  const trimmed = value.trim();
  if (!trimmed) {
    if (required) issues.push(issue(field, `${label} is required.`));
    return issues;
  }
  if (trimmed.length < 2) {
    issues.push(issue(field, `${label} must use at least 2 characters.`));
  }
  if (trimmed.length > maximum) {
    issues.push(
      issue(field, `${label} must use ${maximum} characters or fewer.`),
    );
  }
  if (!isPlainText(trimmed)) {
    issues.push(issue(field, `${label} must be plain text.`));
  }
  return issues;
}

function isBoundedInteger(value: number, maximum: number) {
  return Number.isInteger(value) && value >= 0 && value <= maximum;
}

export function validateSeries(series: SeriesConfig): ValidationIssue[] {
  if (series.kind === "single") {
    return series.winsRequired === 1 && series.maximumRounds === 1
      ? []
      : [issue("formatConfig.series", "Single round must end at one win.")];
  }
  if (series.kind === "best-of") {
    const expected = (series.maximumRounds + 1) / 2;
    return [3, 5, 7].includes(series.maximumRounds) &&
      series.winsRequired === expected
      ? []
      : [issue("formatConfig.series", "Choose best of 3, 5, or 7.")];
  }
  if (
    !Number.isInteger(series.winsRequired) ||
    series.winsRequired < 1 ||
    series.winsRequired > competitionLimits.firstTo ||
    series.maximumRounds !== series.winsRequired * 2 - 1
  ) {
    return [
      issue(
        "formatConfig.series",
        `First to N must use 1–${competitionLimits.firstTo} wins and the derived maximum rounds.`,
      ),
    ];
  }
  return [];
}

function validateScore(value: number, field: string) {
  return isBoundedInteger(value, competitionLimits.score)
    ? []
    : [
        issue(
          field,
          `Points must be a whole number from 0 to ${competitionLimits.score}.`,
        ),
      ];
}

export function validateScoring(
  values: CompetitionFormValues,
  mode: "draft" | "publish" = "publish",
): ValidationIssue[] {
  const scoring = values.scoringConfig;
  const issues: ValidationIssue[] = [];
  if (values.format === "all-hands") {
    if (scoring.kind !== "all-hands") {
      return [issue("scoringConfig", "All Hands scoring is required.")];
    }
    issues.push(
      ...validateScore(scoring.winnerBonus, "scoringConfig.winnerBonus"),
      ...validateScore(
        scoring.participationPoints,
        "scoringConfig.participationPoints",
      ),
    );
    const places = new Set<number>();
    if (
      mode === "publish" &&
      scoring.placementPoints.length > values.participantIds.length
    ) {
      issues.push(
        issue(
          "scoringConfig.placementPoints",
          "Placement awards cannot outnumber the selected participants.",
        ),
      );
    }
    scoring.placementPoints.forEach((award, index) => {
      if (
        !Number.isInteger(award.place) ||
        award.place < 1 ||
        award.place > competitionLimits.participants ||
        (mode === "publish" && award.place > values.participantIds.length)
      ) {
        issues.push(
          issue(
            `scoringConfig.placementPoints.${index}.place`,
            "Placement must be a valid finishing position.",
          ),
        );
      }
      if (places.has(award.place)) {
        issues.push(
          issue(
            `scoringConfig.placementPoints.${index}.place`,
            "Each placement may appear only once.",
          ),
        );
      }
      places.add(award.place);
      issues.push(
        ...validateScore(
          award.points,
          `scoringConfig.placementPoints.${index}.points`,
        ),
      );
      if (
        index > 0 &&
        award.points > scoring.placementPoints[index - 1]!.points
      ) {
        issues.push(
          issue(
            `scoringConfig.placementPoints.${index}.points`,
            "A lower finishing position awards more points than the one above it.",
            "warning",
          ),
        );
      }
    });
    return issues;
  }

  if (scoring.kind !== "head-to-head") {
    return [issue("scoringConfig", "Head-to-head scoring is required.")];
  }
  Object.entries(scoring.table).forEach(([key, value]) => {
    issues.push(...validateScore(value, `scoringConfig.table.${key}`));
  });
  Object.entries(scoring.overall).forEach(([key, value]) => {
    issues.push(...validateScore(value, `scoringConfig.overall.${key}`));
  });
  return issues;
}

export function validateCompetition(
  values: CompetitionFormValues,
  mode: "draft" | "publish" = "publish",
): ValidationIssue[] {
  const required = mode === "publish";
  const issues = [
    ...validateText(
      values.title,
      "title",
      "Competition title",
      competitionLimits.title,
      required,
    ),
    ...validateText(
      values.gameName,
      "gameName",
      "Game name",
      competitionLimits.gameName,
      required,
    ),
  ];
  if (values.description.trim()) {
    if (values.description.trim().length > competitionLimits.description) {
      issues.push(
        issue(
          "description",
          `Description must use ${competitionLimits.description} characters or fewer.`,
        ),
      );
    }
    if (!isPlainText(values.description.trim())) {
      issues.push(issue("description", "Description must be plain text."));
    }
  }
  if (!competitionIconKeys.includes(values.iconKey)) {
    issues.push(issue("iconKey", "Choose an available competition icon."));
  }
  if (values.formatConfig.kind !== values.format) {
    issues.push(
      issue("formatConfig", "Format settings do not match the chosen format."),
    );
  }
  if (values.participantIds.length > competitionLimits.participants) {
    issues.push(
      issue(
        "participantIds",
        `Select no more than ${competitionLimits.participants} participants.`,
      ),
    );
  }
  if (new Set(values.participantIds).size !== values.participantIds.length) {
    issues.push(
      issue("participantIds", "Participant IDs must not be duplicated."),
    );
  }
  if (
    values.participantIds.some(
      (id) => !id || id.length > competitionLimits.participantId,
    )
  ) {
    issues.push(issue("participantIds", "A participant reference is invalid."));
  }
  const minimum = formatPresentation[values.format].minimumParticipants;
  if (required && values.participantIds.length < minimum) {
    issues.push(
      issue(
        "participantIds",
        `${formatPresentation[values.format].label} needs at least ${minimum} participants.`,
      ),
    );
  }

  const config = values.formatConfig;
  if (config.kind === "round-robin-knockout") {
    issues.push(...validateSeries(config.series));
    if (
      required &&
      (!Number.isInteger(config.qualificationCount) ||
        config.qualificationCount < 2 ||
        config.qualificationCount > values.participantIds.length ||
        config.qualificationCount % 2 !== 0)
    ) {
      issues.push(
        issue(
          "formatConfig.qualificationCount",
          "Qualifiers must be an even number of at least 2 and no more than the selected field.",
        ),
      );
    }
    if (
      required &&
      ![2, 4, 8].includes(config.qualificationCount) &&
      config.qualificationCount % 2 === 0
    ) {
      issues.push(
        issue(
          "formatConfig.qualificationCount",
          "This non-standard qualifier count may require byes in the later bracket.",
          "warning",
        ),
      );
    }
  } else if (config.kind === "group-knockout") {
    issues.push(...validateSeries(config.series));
    const recommended = recommendedGroupCount(values.participantIds.length);
    const groupCount =
      config.groupCountMode === "automatic" && recommended
        ? recommended
        : config.groupCount;
    if (
      required &&
      config.groupCountMode === "automatic" &&
      recommended === null
    ) {
      issues.push(
        issue(
          "formatConfig.groupCountMode",
          "Choose a manual group count outside the 4–16 player automatic range.",
        ),
      );
    }
    if (
      !Number.isInteger(groupCount) ||
      groupCount < 1 ||
      groupCount > competitionLimits.groups
    ) {
      issues.push(
        issue(
          "formatConfig.groupCount",
          `Group count must be between 1 and ${competitionLimits.groups}.`,
        ),
      );
    }
    if (
      required &&
      (groupCount > values.participantIds.length ||
        Math.floor(values.participantIds.length / groupCount) < 2)
    ) {
      issues.push(
        issue(
          "formatConfig.groupCount",
          "Every future group needs at least two participants.",
        ),
      );
    }
    if (
      !Number.isInteger(config.qualifiersPerGroup) ||
      config.qualifiersPerGroup < 1 ||
      (required &&
        config.qualifiersPerGroup >=
          Math.ceil(values.participantIds.length / groupCount))
    ) {
      issues.push(
        issue(
          "formatConfig.qualifiersPerGroup",
          "Qualifiers per group must leave at least one non-qualifier in each group.",
        ),
      );
    }
    const qualifierTotal = groupCount * config.qualifiersPerGroup;
    if (required && (qualifierTotal < 2 || qualifierTotal % 2 !== 0)) {
      issues.push(
        issue(
          "formatConfig.qualifiersPerGroup",
          "The total qualifier field must be an even number of at least 2.",
        ),
      );
    }
  } else {
    if (!allHandsResultModes.includes(config.resultMode)) {
      issues.push(issue("formatConfig.resultMode", "Choose a result mode."));
    }
    if (
      config.sessionPlan.kind === "planned" &&
      (!Number.isInteger(config.sessionPlan.sessionCount) ||
        config.sessionPlan.sessionCount < 1 ||
        config.sessionPlan.sessionCount > competitionLimits.sessions)
    ) {
      issues.push(
        issue(
          "formatConfig.sessionPlan",
          `Planned sessions must be between 1 and ${competitionLimits.sessions}.`,
        ),
      );
    }
    [
      ["primaryMetricLabel", config.primaryMetricLabel],
      ["secondaryMetricLabel", config.secondaryMetricLabel],
    ].forEach(([field, value]) => {
      if (
        typeof value === "string" &&
        (value.length > competitionLimits.metricLabel || !isPlainText(value))
      ) {
        issues.push(
          issue(
            `formatConfig.${field}`,
            `Metric labels must be plain text up to ${competitionLimits.metricLabel} characters.`,
          ),
        );
      }
    });
    if (!["higher", "lower"].includes(config.primaryMetricDirection)) {
      issues.push(
        issue(
          "formatConfig.primaryMetricDirection",
          "Choose whether the primary metric ranks higher or lower values first.",
        ),
      );
    }
    if (config.secondaryMetricLabel && !config.secondaryMetricDirection) {
      issues.push(
        issue(
          "formatConfig.secondaryMetricDirection",
          "Choose a direction for the secondary metric.",
        ),
      );
    }
    if (
      !config.secondaryMetricLabel &&
      config.secondaryMetricDirection !== null
    ) {
      issues.push(
        issue(
          "formatConfig.secondaryMetricDirection",
          "A secondary direction requires a secondary metric label.",
        ),
      );
    }
    if (!["shared-placement", "manual-order"].includes(config.tieHandling)) {
      issues.push(issue("formatConfig.tieHandling", "Choose a tie policy."));
    }
  }

  issues.push(...validateScoring(values, mode));
  return issues;
}

export function normalizeCompetitionText(
  values: CompetitionFormValues,
): CompetitionFormValues {
  const participantIds = [...new Set(values.participantIds)];
  const recommendation = recommendedGroupCount(participantIds.length);
  const formatConfig =
    values.formatConfig.kind === "group-knockout" &&
    values.formatConfig.groupCountMode === "automatic" &&
    recommendation
      ? { ...values.formatConfig, groupCount: recommendation }
      : values.formatConfig;
  return {
    ...values,
    title: values.title.trim().replace(/\s+/g, " "),
    gameName: values.gameName.trim().replace(/\s+/g, " "),
    description: values.description.trim().replace(/\s+/g, " "),
    participantIds,
    formatConfig,
  };
}

export function participantReferenceWarnings(
  participantIds: string[],
  participants: ParticipantReference[],
): ParticipantReferenceWarning[] {
  const byId = new Map(
    participants.map((participant) => [participant.id, participant]),
  );
  const warnings: ParticipantReferenceWarning[] = [];
  participantIds.forEach((participantId) => {
    const participant = byId.get(participantId);
    if (!participant) {
      warnings.push({
        participantId,
        kind: "missing",
        message: `Participant ${participantId} is no longer available.`,
      });
      return;
    }
    if (participant.status === "inactive") {
      warnings.push({
        participantId,
        kind: "inactive",
        message: `${participant.displayName} is inactive but remains selected.`,
      });
    }
  });
  return warnings;
}

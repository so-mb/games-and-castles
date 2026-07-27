import type { PublishedCompetition } from "../../competitions/domain/types";
import type { AnyCompetitionRun } from "../../competitions/engine/types";
import type { CompetitionLedgerSnapshot, ReconciliationItem } from "./types";
import { deriveCompetitionLedgerSnapshot } from "../ledger/snapshot";

export function deriveReconciliationItems(input: {
  competitions: PublishedCompetition[];
  runs: AnyCompetitionRun[];
  sources: CompetitionLedgerSnapshot[];
  invalidRunIds?: string[];
  invalidSourceIds?: string[];
}): ReconciliationItem[] {
  const competitions = new Map(
    input.competitions.map((item) => [item.id, item]),
  );
  const runs = new Map(input.runs.map((item) => [item.competitionId, item]));
  const sources = new Map(
    input.sources.map((item) => [item.meta.competitionId, item]),
  );
  const ids = new Set([
    ...competitions.keys(),
    ...runs.keys(),
    ...sources.keys(),
    ...(input.invalidRunIds ?? []),
    ...(input.invalidSourceIds ?? []),
  ]);
  return [...ids]
    .map<ReconciliationItem>((competitionId) => {
      const competition = competitions.get(competitionId);
      const run = runs.get(competitionId);
      const persisted = sources.get(competitionId) ?? null;
      const title =
        competition?.title ??
        persisted?.meta.competitionTitle ??
        "Unknown competition";
      if (input.invalidRunIds?.includes(competitionId)) {
        return item(
          "malformed-run",
          "The runtime is malformed and cannot be reconciled.",
        );
      }
      if (input.invalidSourceIds?.includes(competitionId)) {
        return item(
          "malformed-source",
          "The persisted ledger source is malformed.",
        );
      }
      if (!competition || !run) {
        if (persisted)
          return item(
            "orphaned",
            "No valid runtime exists for this ledger source.",
          );
        return item("not-expected", null);
      }
      if (
        competition.status !== "active" &&
        competition.status !== "completed"
      ) {
        return persisted
          ? item(
              "orphaned",
              "A scheduled or archived competition must not retain awards.",
            )
          : item("not-expected", null);
      }
      let expected: CompetitionLedgerSnapshot;
      try {
        expected = deriveCompetitionLedgerSnapshot({ competition, run });
      } catch {
        return item(
          "unsupported",
          "This competition state cannot produce a safe ledger snapshot.",
        );
      }
      if (!persisted)
        return item(
          "missing",
          "This existing run needs a Phase 7 backfill.",
          expected,
        );
      const synced =
        persisted.meta.runRevision === expected.meta.runRevision &&
        persisted.meta.sourceFingerprint === expected.meta.sourceFingerprint;
      return item(
        synced ? "in-sync" : "stale",
        synced
          ? null
          : "The runtime revision or scoring fingerprint has changed.",
        expected,
      );

      function item(
        status: ReconciliationItem["status"],
        warning: string | null,
        expected: CompetitionLedgerSnapshot | null = null,
      ): ReconciliationItem {
        return {
          competitionId,
          competitionTitle: title,
          status,
          expected,
          persisted,
          entryDelta:
            (expected?.meta.entryCount ?? 0) -
            (persisted?.meta.entryCount ?? 0),
          warning,
        };
      }
    })
    .sort((left, right) =>
      left.competitionTitle.localeCompare(right.competitionTitle),
    );
}

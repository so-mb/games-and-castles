import {
  championshipAwardTypes,
  type ChampionshipLedgerEntry,
  type CompetitionLedgerSnapshot,
  type ManualChampionshipBonus,
} from "../domain/types";

function record(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function plain(value: unknown, maximum = 280): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.length <= maximum &&
    !/[<>]/.test(value) &&
    ![...value].some((character) => {
      const code = character.charCodeAt(0);
      return code < 32 || code === 127;
    })
  );
}

function integer(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

function parseEntry(
  id: string,
  raw: unknown,
  competitionId: string,
): ChampionshipLedgerEntry | null {
  if (!record(raw)) return null;
  const stage = raw.stage ?? null;
  if (
    raw.id !== id ||
    !plain(raw.participantId, 128) ||
    raw.sourceNamespace !== "competition" ||
    raw.sourceId !== competitionId ||
    !plain(raw.sourceEntityId, 128) ||
    !championshipAwardTypes.includes(
      raw.sourceType as (typeof championshipAwardTypes)[number],
    ) ||
    !integer(raw.points) ||
    raw.points <= 0 ||
    raw.points > 10000 ||
    !plain(raw.label) ||
    raw.competitionId !== competitionId ||
    !["round-robin-knockout", "all-hands", "group-knockout"].includes(
      String(raw.competitionFormat),
    ) ||
    (stage !== null && !plain(stage, 64)) ||
    !integer(raw.awardedAt) ||
    !integer(raw.sourceRevision) ||
    raw.sourceRevision < 1 ||
    raw.schemaVersion !== 1
  ) {
    return null;
  }
  return { ...raw, stage } as ChampionshipLedgerEntry;
}

export function parseCompetitionLedgerSource(
  competitionId: string,
  raw: unknown,
): CompetitionLedgerSnapshot | null {
  if (!record(raw) || !record(raw.meta)) return null;
  const meta = raw.meta;
  if (
    meta.competitionId !== competitionId ||
    !["round-robin-knockout", "all-hands", "group-knockout"].includes(
      String(meta.competitionFormat),
    ) ||
    !["active", "completed"].includes(String(meta.competitionStatus)) ||
    !plain(meta.competitionTitle, 60) ||
    !integer(meta.runRevision) ||
    meta.runRevision < 1 ||
    typeof meta.sourceFingerprint !== "string" ||
    !/^[a-f0-9]{16}$/.test(meta.sourceFingerprint) ||
    !integer(meta.generatedAt) ||
    meta.generatedBy !== "organizer" ||
    !integer(meta.entryCount) ||
    meta.entryCount > 10000 ||
    meta.schemaVersion !== 1
  ) {
    return null;
  }
  const rawEntries = raw.entries ?? {};
  if (!record(rawEntries)) return null;
  const entries: Record<string, ChampionshipLedgerEntry> = {};
  for (const [id, value] of Object.entries(rawEntries)) {
    const entry = parseEntry(id, value, competitionId);
    if (!entry) return null;
    entries[id] = entry;
  }
  if (Object.keys(entries).length !== meta.entryCount) return null;
  return {
    meta: meta as unknown as CompetitionLedgerSnapshot["meta"],
    entries,
  };
}

export function parseCompetitionLedgerCollection(raw: unknown) {
  if (!record(raw)) return { sources: [], invalidIds: [] };
  const sources: CompetitionLedgerSnapshot[] = [];
  const invalidIds: string[] = [];
  Object.entries(raw).forEach(([id, value]) => {
    const source = parseCompetitionLedgerSource(id, value);
    if (source) sources.push(source);
    else invalidIds.push(id);
  });
  return { sources, invalidIds };
}

export function parseManualBonus(
  id: string,
  raw: unknown,
): ManualChampionshipBonus | null {
  if (!record(raw)) return null;
  const note = raw.note ?? null;
  const revokedAt = raw.revokedAt ?? null;
  const revokedByUid = raw.revokedByUid ?? null;
  if (
    raw.id !== id ||
    !plain(raw.participantId, 128) ||
    !integer(raw.points) ||
    raw.points < 1 ||
    raw.points > 100 ||
    !plain(raw.label, 80) ||
    (note !== null && !plain(note, 280)) ||
    !["active", "revoked"].includes(String(raw.status)) ||
    !integer(raw.createdAt) ||
    !plain(raw.createdByUid, 128) ||
    !integer(raw.updatedAt) ||
    !plain(raw.updatedByUid, 128) ||
    (revokedAt !== null && !integer(revokedAt)) ||
    (revokedByUid !== null && !plain(revokedByUid, 128)) ||
    (raw.status === "active" &&
      (revokedAt !== null || revokedByUid !== null)) ||
    (raw.status === "revoked" &&
      (revokedAt === null || revokedByUid === null)) ||
    !integer(raw.revision) ||
    raw.revision < 1 ||
    raw.schemaVersion !== 1
  ) {
    return null;
  }
  return { ...raw, note, revokedAt, revokedByUid } as ManualChampionshipBonus;
}

export function parseManualBonusCollection(raw: unknown) {
  if (!record(raw)) return { bonuses: [], invalidIds: [] };
  const bonuses: ManualChampionshipBonus[] = [];
  const invalidIds: string[] = [];
  Object.entries(raw).forEach(([id, value]) => {
    const bonus = parseManualBonus(id, value);
    if (bonus) bonuses.push(bonus);
    else invalidIds.push(id);
  });
  return { bonuses, invalidIds };
}

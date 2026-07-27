export function stableSerialize(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableSerialize(item)).join(",")}]`;
  }
  return `{${Object.entries(value as Record<string, unknown>)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, item]) => `${JSON.stringify(key)}:${stableSerialize(item)}`)
    .join(",")}}`;
}

export function stableHash(value: unknown) {
  const input = stableSerialize(value);
  let first = 0x811c9dc5;
  let second = 0x9e3779b9;
  for (let index = 0; index < input.length; index += 1) {
    const code = input.charCodeAt(index);
    first = Math.imul(first ^ code, 0x01000193) >>> 0;
    second = Math.imul(second ^ code, 0x85ebca6b) >>> 0;
  }
  return `${first.toString(16).padStart(8, "0")}${second
    .toString(16)
    .padStart(8, "0")}`;
}

export function createCompetitionLedgerEntryId(input: {
  competitionId: string;
  participantId: string;
  awardType: string;
  sourceEntityId: string;
  discriminator?: string;
}) {
  const prefix = [...input.awardType]
    .map((character) => (".#$/[]".includes(character) ? "-" : character))
    .join("")
    .slice(0, 28);
  return `${prefix}-${stableHash(input)}`;
}

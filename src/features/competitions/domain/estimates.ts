export function roundRobinMatchCount(participants: number) {
  return participants < 2 ? 0 : (participants * (participants - 1)) / 2;
}

export function roundRobinRoundEstimate(participants: number) {
  if (participants < 2)
    return { rounds: 0, matchesPerRound: 0, hasByes: false };
  return {
    rounds: participants % 2 === 0 ? participants - 1 : participants,
    matchesPerRound: Math.floor(participants / 2),
    hasByes: participants % 2 === 1,
  };
}

export function knockoutMatchEstimate(
  qualifiers: number,
  includeThirdPlace: boolean,
) {
  return qualifiers < 2 ? 0 : qualifiers - 1 + (includeThirdPlace ? 1 : 0);
}

export function recommendedGroupCount(participants: number) {
  if (participants >= 4 && participants <= 5) return 1;
  if (participants >= 6 && participants <= 8) return 2;
  if (participants >= 9 && participants <= 12) return 3;
  if (participants >= 13 && participants <= 16) return 4;
  return null;
}

export function balancedGroupSizes(participants: number, groups: number) {
  if (participants < 1 || groups < 1 || groups > participants) return [];
  const base = Math.floor(participants / groups);
  const largerGroups = participants % groups;
  return Array.from(
    { length: groups },
    (_, index) => base + (index < largerGroups ? 1 : 0),
  );
}

export function groupMatchEstimate(groupSizes: number[], legs: 1 | 2) {
  return groupSizes.reduce(
    (total, size) => total + roundRobinMatchCount(size) * legs,
    0,
  );
}

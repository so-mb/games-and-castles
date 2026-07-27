import type { BirthdayEmojiKey } from "./types";

export const birthdayEmojiOptions: Array<{
  key: BirthdayEmojiKey;
  symbol: string;
  label: string;
}> = [
  { key: "cake", symbol: "🎂", label: "Birthday cake" },
  { key: "heart", symbol: "♥", label: "Warm heart" },
  { key: "sparkles", symbol: "✦", label: "Sparkles" },
  { key: "crown", symbol: "♛", label: "Crown" },
  { key: "castle", symbol: "♜", label: "Castle" },
  { key: "confetti", symbol: "◇", label: "Celebration" },
];

export function birthdayEmojiSymbol(key: BirthdayEmojiKey | null) {
  return (
    birthdayEmojiOptions.find((option) => option.key === key)?.symbol ?? null
  );
}

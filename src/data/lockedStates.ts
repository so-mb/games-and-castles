import type { LockedDisplayState } from "../types/content";

export const birthdayVaultState: LockedDisplayState = {
  id: "birthday-vault",
  eyebrow: "Private guestbook · preview",
  title: "Birthday Vault",
  description:
    "A quiet place for notes, stories and good wishes—collected privately and presented together later.",
  status: "Locked for now",
  phaseNote: "Interactive submissions arrive in a later phase.",
  countLabel: "— messages waiting",
  icon: "cake",
};

export const specialRevealState: LockedDisplayState = {
  id: "special-reveal",
  eyebrow: "A sealed weekend moment",
  title: "Special Reveal",
  description:
    "Predictions and the presentation will appear here only when the protected experience is ready.",
  status: "Reveal locked",
  phaseNote: "This preview is presentation-only and contains no reveal data.",
  icon: "sparkles",
};

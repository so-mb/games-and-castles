import { Check, Minus, X } from "lucide-react";
import type { RecentFormResult } from "./form";

const resultLabels: Record<RecentFormResult, string> = {
  win: "Win",
  draw: "Draw",
  loss: "Loss",
};

const resultStyles: Record<RecentFormResult, string> = {
  win: "border-[var(--color-success-500)] bg-[var(--color-success-500)] text-white",
  draw: "border-white/25 bg-white/12 text-white/72",
  loss: "border-[var(--color-error-500)] bg-[var(--color-error-500)] text-white",
};

function ResultIcon({ result }: { result: RecentFormResult }) {
  if (result === "win") return <Check aria-hidden="true" size={12} />;
  if (result === "loss") return <X aria-hidden="true" size={12} />;
  return <Minus aria-hidden="true" size={12} />;
}

export function FormIndicator({
  participantName,
  results,
}: {
  participantName: string;
  results: RecentFormResult[];
}) {
  const slots: Array<RecentFormResult | null> = [
    ...results.slice(-5),
    ...Array(Math.max(0, 5 - results.length)).fill(null),
  ];
  const summary = results.length
    ? results.map((result) => resultLabels[result]).join(", ")
    : "No completed matches";

  return (
    <ol
      aria-label={`${participantName}, last five results: ${summary}`}
      className="flex min-w-[7.25rem] justify-end gap-1.5"
    >
      {slots.map((result, index) => (
        <li
          className={`flex size-5 shrink-0 items-center justify-center rounded-full border ${
            result ? resultStyles[result] : "border-white/25 bg-transparent"
          }`}
          key={`${result ?? "empty"}-${index}`}
        >
          {result ? (
            <>
              <ResultIcon result={result} />
              <span className="sr-only">{resultLabels[result]}</span>
            </>
          ) : (
            <span className="sr-only">No result</span>
          )}
        </li>
      ))}
    </ol>
  );
}

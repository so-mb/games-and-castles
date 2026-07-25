import type { ContentIcon as ContentIconName } from "../../types/content";
import { ContentIcon } from "../ui/ContentIcon";

interface EmptyStateProps {
  icon: ContentIconName;
  title: string;
  description: string;
}

export function EmptyState({ icon, title, description }: EmptyStateProps) {
  return (
    <div className="rounded-2xl border border-dashed border-white/15 bg-white/[0.025] p-5 text-center">
      <span className="mx-auto flex size-11 items-center justify-center rounded-full bg-white/5 text-white/55">
        <ContentIcon name={icon} size={21} />
      </span>
      <h3 className="mt-3 text-base font-bold text-white">{title}</h3>
      <p className="mt-1 text-sm leading-6 text-white/52">{description}</p>
    </div>
  );
}

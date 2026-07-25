import type { ItineraryItem as ItineraryItemData } from "../../types/content";
import { ContentIcon } from "./ContentIcon";
import { StatusBadge } from "./StatusBadge";
import { Surface } from "./Surface";

interface TimelineItemProps {
  item: ItineraryItemData;
  index: number;
}

export function TimelineItem({ item, index }: TimelineItemProps) {
  return (
    <>
      <time className="font-score pl-14 text-sm font-extrabold text-[var(--color-prague-red-700)] md:pt-5 md:pr-2 md:pl-0 md:text-right">
        {item.time}
      </time>
      <div
        aria-hidden="true"
        className="timeline-marker absolute top-0 left-0 z-10 flex size-10 items-center justify-center rounded-full border-2 border-[var(--color-prague-red-600)] bg-[var(--color-cream-100)] text-[var(--color-prague-red-700)] md:static md:mt-3"
      >
        <ContentIcon name={item.icon} size={18} strokeWidth={2} />
      </div>
      <Surface className="ml-12 p-4 sm:p-5 md:ml-0" variant="editorial">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-bold tracking-[0.16em] text-[var(--color-ink-600)] uppercase">
              Stop {String(index + 1).padStart(2, "0")}
            </p>
            <h3 className="mt-1 text-xl leading-6 font-extrabold text-balance">
              {item.title}
            </h3>
          </div>
          <ContentIcon
            className="hidden text-[var(--color-prague-red-600)] sm:block"
            name={item.icon}
            size={24}
          />
        </div>
        <p className="mt-3 text-sm leading-6 font-medium text-[var(--color-ink-600)] sm:text-base">
          {item.summary}
        </p>
        <ul className="mt-3 space-y-1.5 text-sm leading-6 text-[var(--color-ink-600)]">
          {item.details.map((detail) => (
            <li className="flex gap-2" key={detail}>
              <span
                aria-hidden="true"
                className="mt-[0.65rem] size-1 shrink-0 rounded-full bg-[var(--color-prague-red-600)]"
              />
              <span>{detail}</span>
            </li>
          ))}
        </ul>
        <div className="mt-4 flex flex-wrap gap-2">
          {item.tags.map((tag) => (
            <StatusBadge icon={tag.icon} key={tag.id} tone={tag.tone}>
              {tag.label}
            </StatusBadge>
          ))}
        </div>
      </Surface>
    </>
  );
}

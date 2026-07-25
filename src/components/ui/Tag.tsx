import type { ReactNode } from "react";
import { cn } from "../../lib/cn";

interface TagProps {
  children: ReactNode;
  className?: string;
}

export function Tag({ children, className }: TagProps) {
  return (
    <span
      className={cn(
        "inline-flex min-h-8 items-center rounded-full border border-current/15 bg-current/5 px-3 py-1 text-xs font-semibold",
        className,
      )}
    >
      {children}
    </span>
  );
}

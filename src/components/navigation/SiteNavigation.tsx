import { Castle } from "lucide-react";
import { useMemo } from "react";
import { navigationItems } from "../../data/trip";
import { cn } from "../../lib/cn";
import { useActiveSection } from "../../hooks/useActiveSection";
import { Container } from "../layout/Container";
import { ContentIcon } from "../ui/ContentIcon";

export function SiteNavigation() {
  const sectionIds = useMemo(() => navigationItems.map((item) => item.id), []);
  const activeSection = useActiveSection(
    sectionIds,
    navigationItems[0]?.id ?? "weekend",
  );

  return (
    <header className="site-navigation sticky top-0 z-50 border-b border-white/8 bg-[rgba(9,14,24,0.94)] text-[var(--color-paper-50)] shadow-lg shadow-black/10 backdrop-blur-md">
      <Container className="flex min-h-15 items-center gap-3 !px-0 sm:!px-6 lg:min-h-16">
        <a
          aria-label="Games & Castles — back to top"
          className="hidden min-h-11 shrink-0 items-center gap-2 rounded-lg px-2 font-bold tracking-tight focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-electric-cyan-400)] sm:flex"
          href="#top"
        >
          <span className="flex size-8 items-center justify-center rounded-lg border border-[var(--color-antique-gold-400)]/30 bg-[var(--color-antique-gold-400)]/8 text-[var(--color-antique-gold-400)]">
            <Castle aria-hidden="true" size={18} strokeWidth={1.8} />
          </span>
          <span className="hidden lg:inline">Games &amp; Castles</span>
        </a>

        <nav
          aria-label="Primary"
          className="min-w-0 flex-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          <ul className="mx-auto flex w-max min-w-full items-center justify-center px-1 sm:justify-end sm:px-0">
            {navigationItems.map((item) => {
              const isActive = activeSection === item.id;

              return (
                <li key={item.id}>
                  <a
                    aria-current={isActive ? "location" : undefined}
                    className={cn(
                      "nav-link relative flex min-h-12 min-w-12 flex-col items-center justify-center gap-0.5 rounded-lg px-1 text-[0.68rem] font-bold text-white/58 transition hover:bg-white/5 hover:text-white focus-visible:outline-3 focus-visible:outline-offset-[-3px] focus-visible:outline-[var(--color-electric-cyan-400)] sm:min-h-11 sm:min-w-0 sm:flex-row sm:gap-2 sm:px-3 sm:text-sm",
                      isActive && "text-[var(--color-electric-cyan-400)]",
                    )}
                    href={`#${item.id}`}
                  >
                    <ContentIcon name={item.icon} size={16} strokeWidth={2} />
                    <span>{item.shortLabel}</span>
                    <span
                      aria-hidden="true"
                      className={cn(
                        "absolute right-2 bottom-0 left-2 h-0.5 origin-center rounded-full bg-[var(--color-electric-cyan-400)] transition-transform duration-200",
                        isActive ? "scale-x-100" : "scale-x-0",
                      )}
                    />
                  </a>
                </li>
              );
            })}
          </ul>
        </nav>
      </Container>
    </header>
  );
}

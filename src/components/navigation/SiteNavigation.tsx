import { lazy, Suspense, useMemo } from "react";
import { navigationItems } from "../../data/trip";
import { cn } from "../../lib/cn";
import { useActiveSection } from "../../hooks/useActiveSection";
import { Container } from "../layout/Container";
import { ContentIcon } from "../ui/ContentIcon";

const OrganizerAccess = lazy(() =>
  import("../../features/organizer/OrganizerAccess").then((module) => ({
    default: module.OrganizerAccess,
  })),
);

export function SiteNavigation() {
  const sectionIds = useMemo(() => navigationItems.map((item) => item.id), []);
  const activeSection = useActiveSection(
    sectionIds,
    navigationItems[0]?.id ?? "weekend",
  );

  return (
    <header className="site-navigation sticky top-0 z-50 border-b border-white/8 bg-[rgba(9,14,24,0.94)] text-[var(--color-paper-50)] shadow-lg shadow-black/10 backdrop-blur-md">
      <Container className="flex min-h-14 items-center gap-0 !px-1 sm:min-h-15 sm:gap-3 sm:!px-6 lg:min-h-16">
        <a
          aria-label="Games & Castles — back to top"
          className="flex size-11 shrink-0 items-center justify-center gap-2 rounded-lg font-bold tracking-tight focus-visible:outline-3 focus-visible:outline-offset-[-3px] focus-visible:outline-[var(--color-electric-cyan-400)] sm:w-auto sm:px-2 sm:focus-visible:outline-offset-2"
          href="#top"
        >
          <img
            alt=""
            aria-hidden="true"
            className="size-8 shrink-0"
            src={`${import.meta.env.BASE_URL}favicon.svg`}
          />
          <span className="hidden lg:inline">Games &amp; Castles</span>
        </a>

        <nav
          aria-label="Primary"
          className="min-w-0 flex-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          <ul className="grid w-full grid-cols-6 items-center md:mx-auto md:flex md:w-max md:min-w-full md:justify-end">
            {navigationItems.map((item) => {
              const isActive = activeSection === item.id;

              return (
                <li className="min-w-0" key={item.id}>
                  <a
                    aria-current={isActive ? "location" : undefined}
                    className={cn(
                      "nav-link relative flex min-h-11 w-full items-center justify-center rounded-lg px-0 font-bold text-white/58 transition hover:bg-white/5 hover:text-white focus-visible:outline-3 focus-visible:outline-offset-[-3px] focus-visible:outline-[var(--color-electric-cyan-400)] md:w-auto md:gap-2 md:px-3 md:text-sm",
                      isActive && "text-[var(--color-electric-cyan-400)]",
                    )}
                    href={`#${item.id}`}
                  >
                    <ContentIcon name={item.icon} size={18} strokeWidth={2} />
                    <span className="sr-only md:not-sr-only">
                      {item.shortLabel}
                    </span>
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

        <Suspense
          fallback={
            <span
              aria-hidden="true"
              className="size-11 shrink-0 rounded-xl border border-white/8 bg-white/4 md:w-24"
            />
          }
        >
          <OrganizerAccess />
        </Suspense>
      </Container>
    </header>
  );
}

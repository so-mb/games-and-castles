import { useEffect, useState } from "react";

interface VisibleSection {
  id: string;
  ratio: number;
  top: number;
}

export function pickActiveSection(
  entries: VisibleSection[],
): string | undefined {
  return [...entries].sort((a, b) => {
    if (b.ratio !== a.ratio) return b.ratio - a.ratio;
    return Math.abs(a.top) - Math.abs(b.top);
  })[0]?.id;
}

export function useActiveSection(
  sectionIds: string[],
  initialId: string,
): string {
  const [activeSection, setActiveSection] = useState(initialId);

  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return undefined;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .map((entry) => ({
            id: entry.target.id,
            ratio: entry.intersectionRatio,
            top: entry.boundingClientRect.top,
          }));
        const nextSection = pickActiveSection(visible);

        if (nextSection) setActiveSection(nextSection);
      },
      {
        rootMargin: "-28% 0px -58% 0px",
        threshold: [0, 0.15, 0.35, 0.65],
      },
    );

    const sections = sectionIds
      .map((id) => document.getElementById(id))
      .filter((section): section is HTMLElement => section !== null);

    sections.forEach((section) => observer.observe(section));

    return () => observer.disconnect();
  }, [sectionIds]);

  return activeSection;
}

import { Castle, MapPin, Sparkles } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import { tripMetadata } from "../../data/trip";
import { Container } from "../../components/layout/Container";
import { Button } from "../../components/ui/Button";
import { StatusBadge } from "../../components/ui/StatusBadge";

export function HeroSection() {
  const reduceMotion = useReducedMotion();
  const entrance = (delay: number) => ({
    initial: reduceMotion ? false : { opacity: 0, y: 18 },
    animate: { opacity: 1, y: 0 },
    transition: {
      duration: reduceMotion ? 0 : 0.55,
      delay,
      ease: [0.2, 0.75, 0.2, 1] as const,
    },
  });

  return (
    <section
      aria-labelledby="hero-title"
      className="hero-section relative isolate overflow-hidden bg-[var(--color-night-950)] text-[var(--color-paper-50)]"
      id="top"
    >
      <div aria-hidden="true" className="hero-paper-grid" />
      <div aria-hidden="true" className="hero-red-orb" />
      <Container className="relative grid min-h-[min(44rem,88svh)] items-center gap-6 py-10 sm:gap-10 sm:py-16 md:grid-cols-[1.08fr_0.92fr] lg:py-20">
        <div className="relative z-10 max-w-2xl">
          <motion.div {...entrance(0.02)}>
            <StatusBadge icon="ticket" tone="gold">
              {tripMetadata.dateRange}
            </StatusBadge>
          </motion.div>

          <motion.p
            {...entrance(0.08)}
            className="mt-4 flex items-center gap-2 text-sm font-bold tracking-[0.14em] text-[var(--color-electric-cyan-400)] uppercase sm:mt-6"
          >
            <MapPin aria-hidden="true" size={17} />
            {tripMetadata.context}
          </motion.p>

          <motion.h1
            {...entrance(0.14)}
            className="font-display mt-3 max-w-[10ch] text-[clamp(2.9rem,13vw,5.8rem)] leading-[0.88] font-semibold tracking-[-0.045em] text-balance sm:mt-4"
            id="hero-title"
          >
            Games{" "}
            <span className="text-[var(--color-antique-gold-400)]">&amp;</span>{" "}
            Castles
          </motion.h1>

          <motion.p
            {...entrance(0.22)}
            className="mt-4 max-w-xl text-lg leading-7 font-medium text-white/82 text-pretty sm:mt-6 sm:text-xl sm:leading-8"
          >
            {tripMetadata.tagline}
          </motion.p>

          <motion.p
            {...entrance(0.28)}
            className="mt-2 flex items-center gap-2 text-sm text-white/52 sm:mt-3"
          >
            <Sparkles
              aria-hidden="true"
              size={15}
              className="text-[var(--color-antique-gold-400)]"
            />
            {tripMetadata.birthdayNote}
          </motion.p>

          <motion.div
            {...entrance(0.34)}
            className="mt-5 flex flex-wrap gap-3 sm:mt-8"
          >
            <Button href="#weekend" showArrow variant="dark">
              Open the weekend
            </Button>
            <Button
              className="border-white/18 text-white hover:bg-white/7"
              href="#championship"
              variant="secondary"
            >
              Preview the games
            </Button>
          </motion.div>
        </div>

        <motion.div
          {...entrance(0.2)}
          aria-label="A decorative travel-journal view from Germany to Prague"
          className="hero-art relative mx-auto w-full max-w-lg lg:max-w-none"
          role="img"
        >
          <div className="hero-ticket-card">
            <div className="flex items-start justify-between gap-4">
              <span className="text-xs font-black tracking-[0.18em] text-[var(--color-prague-red-700)] uppercase">
                Weekend edition
              </span>
              <span className="font-score text-xs font-bold text-[var(--color-ink-600)]">
                G&amp;C / 2026
              </span>
            </div>
            <div className="hero-route mt-9 grid grid-cols-[auto_1fr_auto] items-center gap-3">
              <span className="text-sm font-extrabold text-[var(--color-ink-900)]">
                DE
              </span>
              <span className="hero-route-track">
                <span />
              </span>
              <span className="text-sm font-extrabold text-[var(--color-prague-red-700)]">
                PRG
              </span>
            </div>
            <div className="hero-ticket-copy mt-8 border-t border-dashed border-[var(--color-ink-900)]/18 pt-6">
              <p className="font-display text-3xl font-semibold text-[var(--color-ink-900)]">
                Three days, one table.
              </p>
              <p className="mt-2 max-w-xs text-sm leading-6 text-[var(--color-ink-600)]">
                Flexible Friday play, a Saturday city quest and an easy Sunday
                departure.
              </p>
            </div>
          </div>

          <div className="hero-castle-stamp" aria-hidden="true">
            <Castle size={58} strokeWidth={1.35} />
            <span>Prague quest</span>
          </div>
        </motion.div>
      </Container>
      <div aria-hidden="true" className="section-edge section-edge-dark" />
    </section>
  );
}

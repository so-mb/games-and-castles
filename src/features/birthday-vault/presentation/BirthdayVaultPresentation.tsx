import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  ChevronLeft,
  ChevronRight,
  Pause,
  Play,
  RotateCcw,
  X,
} from "lucide-react";
import { IconButton } from "../../../components/ui/IconButton";
import { ParticipantAvatar } from "../../../components/ui/ParticipantAvatar";
import { birthdayEmojiSymbol } from "../domain/emoji";
import type { PublishedBirthdayMessage } from "../domain/types";

interface BirthdayVaultPresentationProps {
  messages: PublishedBirthdayMessage[];
  label: string;
  onClose: () => void;
}

export function BirthdayVaultPresentation({
  messages,
  label,
  onClose,
}: BirthdayVaultPresentationProps) {
  const reducedMotion = useReducedMotion();
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const returnFocus = useRef<HTMLElement | null>(null);
  const message = messages[index];

  useEffect(() => {
    returnFocus.current = document.activeElement as HTMLElement | null;
    dialogRef.current?.querySelector<HTMLElement>("button")?.focus();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
      returnFocus.current?.focus();
    };
  }, []);

  useEffect(() => {
    if (!playing || messages.length < 2) return;
    const timer = window.setInterval(() => {
      setIndex((current) => {
        if (current >= messages.length - 1) {
          setPlaying(false);
          return current;
        }
        return current + 1;
      });
    }, 8000);
    return () => window.clearInterval(timer);
  }, [messages.length, playing]);

  useEffect(() => {
    function handleKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
      if (event.key === "ArrowLeft")
        setIndex((current) => Math.max(0, current - 1));
      if (event.key === "ArrowRight")
        setIndex((current) => Math.min(messages.length - 1, current + 1));
      if (event.key !== "Tab" || !dialogRef.current) return;
      const controls = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>(
          "button:not([disabled])",
        ),
      );
      const first = controls[0];
      const last = controls.at(-1);
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [messages.length, onClose]);

  if (!message) return null;
  const atEnd = index === messages.length - 1;
  return createPortal(
    <div className="fixed inset-0 z-[130] overflow-hidden bg-[var(--color-night-950)] text-white">
      <div aria-hidden="true" className="birthday-presentation-glow" />
      <div
        aria-label={`${label}. Message ${index + 1} of ${messages.length}.`}
        aria-modal="true"
        className="relative flex min-h-dvh flex-col p-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:p-7"
        ref={dialogRef}
        role="dialog"
      >
        <header className="flex items-center justify-between gap-4">
          <div>
            <p className="text-xs font-bold tracking-[0.18em] text-[var(--color-antique-gold-400)] uppercase">
              {label}
            </p>
            <p aria-live="polite" className="mt-1 text-sm text-white/60">
              Message {index + 1} of {messages.length}
            </p>
          </div>
          <IconButton
            className="border-white/20 text-white"
            label="Close Birthday Vault presentation"
            onClick={onClose}
          >
            <X aria-hidden="true" size={20} />
          </IconButton>
        </header>

        <div className="flex min-h-0 flex-1 items-center justify-center py-5 sm:py-8">
          <AnimatePresence mode="wait" initial={false}>
            <motion.article
              animate={{ opacity: 1, y: 0 }}
              className="birthday-message-card max-h-[68dvh] w-full max-w-3xl overflow-y-auto rounded-[2rem] border border-[var(--color-antique-gold-400)]/45 bg-[var(--color-cream-50)] p-6 text-[var(--color-ink-900)] shadow-[0_30px_120px_rgba(0,0,0,0.42)] sm:p-10 lg:p-14"
              exit={{
                opacity: reducedMotion ? 1 : 0,
                y: reducedMotion ? 0 : -12,
              }}
              initial={{
                opacity: reducedMotion ? 1 : 0,
                y: reducedMotion ? 0 : 16,
              }}
              key={`${message.id}:${message.revealRevision}`}
              transition={{ duration: reducedMotion ? 0 : 0.28 }}
            >
              <p
                aria-hidden="true"
                className="text-4xl text-[var(--color-prague-red-600)]"
              >
                {birthdayEmojiSymbol(message.emojiKey) ?? "✦"}
              </p>
              {message.title ? (
                <h2 className="font-display mt-5 text-4xl leading-tight font-semibold sm:text-5xl">
                  {message.title}
                </h2>
              ) : null}
              <p className="mt-6 whitespace-pre-wrap text-lg leading-8 sm:text-xl sm:leading-9">
                {message.message}
              </p>
              <div className="mt-8 flex items-center gap-3 border-t border-[var(--color-ink-900)]/12 pt-5">
                {message.author.mode === "named" ? (
                  <ParticipantAvatar
                    accent={message.author.avatarTone}
                    className="!text-[var(--color-ink-900)]"
                    icon={message.author.avatarIcon}
                    initials={message.author.displayName.slice(0, 2)}
                    name={message.author.displayName}
                  />
                ) : (
                  <span
                    aria-hidden="true"
                    className="flex size-11 items-center justify-center rounded-full bg-[var(--color-ink-900)]/8 text-lg"
                  >
                    ✦
                  </span>
                )}
                <div>
                  <p className="font-bold">{message.author.displayName}</p>
                  <p className="text-xs text-[var(--color-ink-600)]">
                    {message.author.mode === "anonymous"
                      ? "Shared anonymously"
                      : "Named message"}
                  </p>
                </div>
              </div>
            </motion.article>
          </AnimatePresence>
        </div>

        <footer className="mx-auto flex w-full max-w-3xl flex-wrap items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 p-2 sm:gap-3">
          <IconButton
            disabled={index === 0}
            label="Previous birthday message"
            onClick={() => setIndex((current) => Math.max(0, current - 1))}
          >
            <ChevronLeft aria-hidden="true" size={20} />
          </IconButton>
          <IconButton
            label={
              playing
                ? "Pause birthday message autoplay"
                : "Play birthday messages automatically"
            }
            onClick={() => setPlaying((current) => !current)}
          >
            {playing ? (
              <Pause aria-hidden="true" size={20} />
            ) : (
              <Play aria-hidden="true" size={20} />
            )}
          </IconButton>
          {atEnd ? (
            <IconButton
              label="Replay birthday messages from the beginning"
              onClick={() => {
                setIndex(0);
                setPlaying(false);
              }}
            >
              <RotateCcw aria-hidden="true" size={19} />
            </IconButton>
          ) : null}
          <IconButton
            disabled={atEnd}
            label="Next birthday message"
            onClick={() =>
              setIndex((current) => Math.min(messages.length - 1, current + 1))
            }
          >
            <ChevronRight aria-hidden="true" size={20} />
          </IconButton>
        </footer>
      </div>
    </div>,
    document.body,
  );
}

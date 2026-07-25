import { motion, useReducedMotion } from "framer-motion";
import type { ReactNode } from "react";
import { cn } from "../../lib/cn";

interface RevealProps {
  children: ReactNode;
  className?: string;
  delay?: number;
  as?: "div" | "li";
}

export function Reveal({
  children,
  className,
  delay = 0,
  as = "div",
}: RevealProps) {
  const reduceMotion = useReducedMotion();
  const Component = as === "li" ? motion.li : motion.div;

  return (
    <Component
      className={cn(className)}
      initial={reduceMotion ? false : { opacity: 0, y: 18 }}
      transition={{
        duration: reduceMotion ? 0 : 0.45,
        delay,
        ease: [0.2, 0.75, 0.2, 1],
      }}
      viewport={{ once: true, amount: 0.12 }}
      whileInView={reduceMotion ? undefined : { opacity: 1, y: 0 }}
    >
      {children}
    </Component>
  );
}

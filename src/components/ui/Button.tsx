import { ArrowRight } from "lucide-react";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "../../lib/cn";

type ButtonVariant = "primary" | "secondary" | "quiet" | "dark";

interface SharedButtonProps {
  children: ReactNode;
  variant?: ButtonVariant;
  className?: string;
  showArrow?: boolean;
}

type ButtonProps = SharedButtonProps &
  Omit<ButtonHTMLAttributes<HTMLButtonElement>, keyof SharedButtonProps> & {
    href?: never;
  };

type ButtonLinkProps = SharedButtonProps & {
  href: string;
  ariaLabel?: string;
};

const variants: Record<ButtonVariant, string> = {
  primary:
    "bg-[var(--color-prague-red-600)] text-white hover:bg-[var(--color-prague-red-700)] active:translate-y-px",
  secondary:
    "border border-[var(--color-ink-900)]/20 bg-transparent text-[var(--color-ink-900)] hover:bg-[var(--color-ink-900)]/5",
  quiet: "bg-transparent text-current hover:bg-current/8",
  dark: "bg-[var(--color-electric-cyan-400)] text-[var(--color-night-950)] hover:bg-[#6be4df] active:translate-y-px",
};

const baseClass =
  "inline-flex min-h-11 flex-row items-center justify-center gap-2 rounded-[var(--radius-md)] px-5 py-2.5 text-center text-sm leading-5 font-bold transition-[color,background-color,border-color,box-shadow,transform] duration-[var(--motion-fast)] ease-out focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-[var(--focus-ring)] disabled:cursor-not-allowed disabled:opacity-45 [&>svg]:shrink-0";

export function Button({
  children,
  variant = "primary",
  className,
  showArrow = false,
  ...props
}: ButtonProps | ButtonLinkProps) {
  const content = (
    <>
      {children}
      {showArrow ? (
        <ArrowRight
          aria-hidden="true"
          className="shrink-0"
          size={17}
          strokeWidth={2}
        />
      ) : null}
    </>
  );

  if ("href" in props && props.href) {
    return (
      <a
        aria-label={props.ariaLabel}
        className={cn(baseClass, variants[variant], className)}
        href={props.href}
      >
        {content}
      </a>
    );
  }

  const { type = "button", ...buttonProps } = props as Omit<
    ButtonProps,
    keyof SharedButtonProps
  >;

  return (
    <button
      {...buttonProps}
      className={cn(baseClass, variants[variant], className)}
      type={type}
    >
      {content}
    </button>
  );
}

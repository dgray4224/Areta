import Link from "next/link";
import type { ButtonHTMLAttributes, ReactNode } from "react";

export type ButtonVariant = "primary" | "onHero" | "secondary";

/** "onHero" reuses `text-hero` (the dark hero-card background color) as
 * dark ink for a white pill sitting on top of that card — one token,
 * two jobs, so it can never drift out of sync with the hero surface. */
const VARIANT_CLASS: Record<ButtonVariant, string> = {
  primary: "bg-brand-fill text-brand-ink hover:opacity-90",
  onHero: "bg-white text-hero hover:bg-white/90",
  secondary:
    "border border-neutral-300 text-foreground hover:bg-black/5 dark:border-neutral-700 dark:hover:bg-white/5",
};

const BASE =
  "inline-flex items-center justify-center rounded-full px-5 py-2.5 text-sm font-semibold transition-colors disabled:opacity-50 disabled:pointer-events-none";

export function Button({
  variant = "primary",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant }) {
  return <button className={`${BASE} ${VARIANT_CLASS[variant]} ${className}`} {...props} />;
}

export function LinkButton({
  href,
  variant = "primary",
  className = "",
  children,
}: {
  href: string;
  variant?: ButtonVariant;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Link href={href} className={`${BASE} ${VARIANT_CLASS[variant]} ${className}`}>
      {children}
    </Link>
  );
}

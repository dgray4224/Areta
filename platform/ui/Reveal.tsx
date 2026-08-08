"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Fades + slides a section in the moment it scrolls into view. Plain
 * IntersectionObserver rather than pulling in an animation library for one
 * effect -- disconnects after first reveal (one-shot, not a repeating
 * scroll gimmick). Respects prefers-reduced-motion by skipping the
 * transition and rendering visible immediately.
 */
export function Reveal({
  children,
  delayMs = 0,
  className,
}: {
  children: React.ReactNode;
  delayMs?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const [skipAnimation, setSkipAnimation] = useState(false);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setSkipAnimation(true);
      setVisible(true);
      return;
    }

    const node = ref.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.15 }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={className}
      style={
        skipAnimation
          ? undefined
          : {
              opacity: visible ? 1 : 0,
              transform: visible ? "translateY(0)" : "translateY(16px)",
              transition: `opacity 0.6s ease-out ${delayMs}ms, transform 0.6s ease-out ${delayMs}ms`,
            }
      }
    >
      {children}
    </div>
  );
}

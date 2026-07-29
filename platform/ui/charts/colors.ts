"use client";

import { useSyncExternalStore } from "react";

/** Kept in sync with the CSS custom properties in app/globals.css.
 * JS-side copy exists because recharts renders SVG presentation attributes
 * (stroke/fill), not inline style, so `var(--x)` isn't reliable there —
 * actual hex values driven by a media-query hook are. */
const LIGHT = {
  textPrimary: "#171717",
  textSecondary: "#737373",
  textMuted: "#a3a3a3",
  gridline: "#e5e5e5",
  baseline: "#d4d4d4",
  series1: "#2a78d6",
  series2: "#eb6834",
  series3: "#1baf7a",
  series4: "#eda100",
  series5: "#e87ba4",
  sequential: "#2a78d6",
  sequentialLight: "#b7d3f6",
  good: "#0ca30c",
  warning: "#fab219",
  serious: "#ec835a",
  critical: "#d03b3b",
};

const DARK = {
  textPrimary: "#fafafa",
  textSecondary: "#a3a3a3",
  textMuted: "#737373",
  gridline: "#262626",
  baseline: "#404040",
  series1: "#3987e5",
  series2: "#d95926",
  series3: "#199e70",
  series4: "#c98500",
  series5: "#d55181",
  sequential: "#3987e5",
  sequentialLight: "#184f95",
  good: "#0ca30c",
  warning: "#fab219",
  serious: "#ec835a",
  critical: "#e66767",
};

export type ChartColors = typeof LIGHT;

/** Tracks the `.dark` class on <html> (platform/theme/theme.ts owns
 * setting it — from a manual Appearance choice or live OS-preference
 * changes via ThemeSync) rather than matchMedia directly, so charts follow
 * the same resolved theme as the rest of the UI instead of always
 * reflecting raw OS preference regardless of an explicit user choice. */
function subscribe(callback: () => void) {
  const observer = new MutationObserver(callback);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
  return () => observer.disconnect();
}

function getSnapshot() {
  return document.documentElement.classList.contains("dark");
}

function getServerSnapshot() {
  return false;
}

/** useSyncExternalStore (not effect+setState) is the correct way to
 * subscribe to external mutable state like a DOM class — SSR-safe via
 * getServerSnapshot, and avoids the effect+setState cascading-render
 * anti-pattern. */
export function useChartColors(): ChartColors {
  const isDark = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  return isDark ? DARK : LIGHT;
}

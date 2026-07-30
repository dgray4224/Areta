"use client";

import { useSyncExternalStore } from "react";

/** Kept in sync with the CSS custom properties in app/globals.css.
 * JS-side copy exists because recharts renders SVG presentation attributes
 * (stroke/fill), not inline style, so `var(--x)` isn't reliable there —
 * actual hex values driven by a media-query hook are. */
/* series1/sequential are tied to the brand terracotta (app/globals.css
 * --brand). series2 stays a cool blue rather than the brand's own orange
 * family — a same-hue second series would fail CVD separation against
 * series1 (validated with the dataviz skill's validate_palette.js).
 * series3-5 are untouched, unused by any chart today. */
const LIGHT = {
  textPrimary: "#171717",
  textSecondary: "#737373",
  textMuted: "#a3a3a3",
  gridline: "#e5e5e5",
  baseline: "#d4d4d4",
  series1: "#c85a3a",
  series2: "#3a6ea8",
  series3: "#1baf7a",
  series4: "#eda100",
  series5: "#e87ba4",
  sequential: "#c85a3a",
  sequentialLight: "#f3d9cb",
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
  series1: "#cf6c46",
  series2: "#5b93d1",
  series3: "#199e70",
  series4: "#c98500",
  series5: "#d55181",
  sequential: "#cf6c46",
  sequentialLight: "#4a2a1c",
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

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

function subscribe(callback: () => void) {
  const mq = window.matchMedia("(prefers-color-scheme: dark)");
  mq.addEventListener("change", callback);
  return () => mq.removeEventListener("change", callback);
}

function getSnapshot() {
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

function getServerSnapshot() {
  return false;
}

/** useSyncExternalStore (not effect+setState) is the correct way to
 * subscribe to an external browser API like matchMedia — SSR-safe via
 * getServerSnapshot, and avoids the effect+setState cascading-render
 * anti-pattern. */
export function useChartColors(): ChartColors {
  const isDark = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  return isDark ? DARK : LIGHT;
}

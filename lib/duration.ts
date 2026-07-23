function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Rough heuristic: ~2.5 minutes of class time per slide, including discussion. */
export function targetSlideCount(durationMinutes: number): number {
  return clamp(Math.round(durationMinutes / 2.5), 2, 80);
}

/** Rough heuristic: ~6 slides per module. */
export function targetModuleCount(durationMinutes: number): number {
  const slides = targetSlideCount(durationMinutes);
  return clamp(Math.round(slides / 6), 1, 10);
}

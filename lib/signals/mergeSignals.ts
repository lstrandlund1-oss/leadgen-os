import { Signal, SignalCategory, SignalSet } from "./signalTypes";

export function mergeSignals(...groups: Signal[][]): SignalSet {
  const flat = groups.flat();

  const byKey: SignalSet["byKey"] = {};
  const byCategory: Partial<Record<SignalCategory, Signal[]>> = {};

  for (const signal of flat) {
    byKey[signal.key] = signal;

    const existing = byCategory[signal.category] ?? [];
    existing.push(signal);
    byCategory[signal.category] = existing;
  }

  const counts = {
    total: flat.length,
    base: flat.filter((signal) => signal.depth === "base").length,
    light: flat.filter((signal) => signal.depth === "light").length,
    deep: flat.filter((signal) => signal.depth === "deep").length,
  };

  const evidenceScore = computeEvidenceScore(flat);

  return {
    byKey,
    byCategory,
    counts,
    evidenceScore,
  };
}

function computeEvidenceScore(signals: Signal[]): number {
  if (signals.length === 0) return 0;

  const totalWeight = signals.reduce((sum, signal) => {
    return sum + signal.reliability;
  }, 0);

  const weightedConfidence = signals.reduce((sum, signal) => {
    return sum + signal.confidence * signal.reliability;
  }, 0);

  const score = weightedConfidence / totalWeight;

  return Math.max(0, Math.min(100, Math.round(score)));
}
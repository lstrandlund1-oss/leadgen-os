import { buildSignal } from "./evidence";
import { mergeSignals } from "./mergeSignals";
import { SignalSet } from "./signalTypes";

interface ExtractSignalsInput {
  rating: number | null;
  reviewCount: number | null;
  website: string | null;
  socialPresence: "low" | "medium" | "high" | null;
  classificationConfidence: number | null;
  isGoodFit: boolean | null;
}

export function extractSignals(input: ExtractSignalsInput): SignalSet {
  const baseSignals = [
    buildSignal({
      key: "rating",
      value: input.rating,
      confidence: input.rating !== null ? 85 : 20,
    }),
    buildSignal({
      key: "review_count",
      value: input.reviewCount,
      confidence: input.reviewCount !== null ? 90 : 25,
    }),
    buildSignal({
      key: "website_exists",
      value: Boolean(input.website),
      confidence: 95,
      present: true,
    }),
    buildSignal({
      key: "social_presence",
      value: input.socialPresence,
      confidence: input.socialPresence !== null ? 60 : 20,
      present: input.socialPresence !== null,
    }),
    buildSignal({
      key: "classification_confidence",
      value: input.classificationConfidence,
      confidence: input.classificationConfidence !== null ? 80 : 20,
    }),
    buildSignal({
      key: "is_good_fit",
      value: input.isGoodFit,
      confidence: input.isGoodFit !== null ? 80 : 20,
      present: input.isGoodFit !== null,
    }),
  ];

  return mergeSignals(baseSignals);
}
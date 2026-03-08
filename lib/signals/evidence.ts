import { SIGNAL_REGISTRY } from "./signalRegistry";
import {
  EvidenceDepth,
  Signal,
  SignalKey,
  SignalSource,
  SignalValuePrimitive,
} from "./signalTypes";

const DEPTH_RELIABILITY: Record<EvidenceDepth, number> = {
  base: 0.5,
  light: 0.75,
  deep: 1,
};

interface BuildSignalInput<T extends SignalValuePrimitive> {
  key: SignalKey;
  value: T;
  present?: boolean;
  confidence?: number;
  source?: SignalSource;
  depth?: EvidenceDepth;
  description?: string;
}

export function buildSignal<T extends SignalValuePrimitive>(
  input: BuildSignalInput<T>,
): Signal<T> {
  const definition = SIGNAL_REGISTRY[input.key];
  const depth = input.depth ?? definition.defaultDepth;

  return {
    key: input.key,
    label: definition.label,
    category: definition.category,
    value: input.value,
    source: input.source ?? definition.defaultSource,
    depth,
    confidence: input.confidence ?? 50,
    reliability: DEPTH_RELIABILITY[depth],
    present: input.present ?? input.value !== null,
    description: input.description ?? definition.description,
  };
}
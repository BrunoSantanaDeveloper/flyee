export interface GapEvent {
  kind: "handoff";
  category: string;
  topic: string;
  reason: string;
  excerpt: string;
  at: string;
}

export interface GapGroup {
  topic: string;
  count: number;
  categories: Record<string, number>;
  examples: string[];
  last_at: string | null;
}

export const GAP_CATEGORIES: Record<string, string>;
export function topicKey(topic: unknown): string;
export function summarizeGaps(
  events: GapEvent[] | null | undefined,
  options?: { days?: number; now?: number; onlyUnknown?: boolean; maxExamples?: number },
): GapGroup[];

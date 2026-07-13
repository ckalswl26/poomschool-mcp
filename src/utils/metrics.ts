export interface ToolTimingSample {
  toolName: string;
  durationMs: number;
  success: boolean;
  timestamp: number;
}

const MAX_SAMPLES_PER_TOOL = 500;
const samples = new Map<string, ToolTimingSample[]>();

export function recordToolTiming(sample: ToolTimingSample): void {
  const list = samples.get(sample.toolName) ?? [];
  list.push(sample);
  if (list.length > MAX_SAMPLES_PER_TOOL) list.shift();
  samples.set(sample.toolName, list);
}

export function getToolTimings(toolName: string): ToolTimingSample[] {
  return samples.get(toolName) ?? [];
}

export function clearAllTimings(): void {
  samples.clear();
}

export function percentile(sortedValues: number[], p: number): number {
  if (sortedValues.length === 0) return 0;
  const idx = Math.min(sortedValues.length - 1, Math.ceil((p / 100) * sortedValues.length) - 1);
  return sortedValues[Math.max(0, idx)] ?? 0;
}

export interface TimingStats {
  count: number;
  avg: number;
  p50: number;
  p95: number;
  p99: number;
  min: number;
  max: number;
  failureRate: number;
}

export function computeStats(durationsMs: number[], failures: number): TimingStats {
  if (durationsMs.length === 0) {
    return { count: 0, avg: 0, p50: 0, p95: 0, p99: 0, min: 0, max: 0, failureRate: 0 };
  }
  const sorted = [...durationsMs].sort((a, b) => a - b);
  const sum = sorted.reduce((a, b) => a + b, 0);
  return {
    count: sorted.length,
    avg: sum / sorted.length,
    p50: percentile(sorted, 50),
    p95: percentile(sorted, 95),
    p99: percentile(sorted, 99),
    min: sorted[0] ?? 0,
    max: sorted[sorted.length - 1] ?? 0,
    failureRate: failures / sorted.length,
  };
}

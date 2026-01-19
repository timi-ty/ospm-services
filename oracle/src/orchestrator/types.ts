export interface TickContext {
  tickCount: number;
  tickTime: Date;
  intervalMs: number;
}

export interface TickHandler {
  tick(context: TickContext): Promise<void>;
}

export function shouldTick(
  lastTickedAt: Date | null,
  tickEveryMs: number,
  currentTime: Date
): boolean {
  if (!lastTickedAt) return true;
  const elapsed = currentTime.getTime() - lastTickedAt.getTime();
  return elapsed >= tickEveryMs;
}

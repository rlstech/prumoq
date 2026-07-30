export const PULL_TRIGGER_DISTANCE = 75;
export const MAX_PULL_DISTANCE = 120;

export function calculatePullDistance(deltaY: number): number {
  if (deltaY <= 0) return 0;
  return Math.min(deltaY * 0.5, MAX_PULL_DISTANCE);
}

export function shouldTriggerRefresh(pullDistance: number): boolean {
  return pullDistance >= PULL_TRIGGER_DISTANCE;
}

export function isPullToRefreshEnabled(segments: readonly string[]): boolean {
  if (segments[0] !== '(app)') return false;
  if (segments.includes('print')) return false;
  if (segments.includes('alterar-senha')) return false;
  if (segments.includes('nova')) return false;
  return true;
}

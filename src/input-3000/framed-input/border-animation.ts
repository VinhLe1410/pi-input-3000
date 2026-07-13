import { BORDER_CHASE } from "../constants";

export interface BorderChase {
  head: number;
  perimeter: number;
  trailLength: number;
  heavyLength: number;
  headLength: number;
}

export function createBorderChase(
  width: number,
  rowCount: number,
  frameIndex: number | undefined,
  frameCount: number | undefined,
): BorderChase | undefined {
  if (frameIndex === undefined || !frameCount) return undefined;

  const perimeter = Math.max(1, width * 2 + rowCount * 2);
  const progress = (frameIndex % frameCount) / frameCount;
  const trailLength = Math.round(perimeter * BORDER_CHASE.trailRatio);
  return {
    head: Math.floor(progress * perimeter),
    perimeter,
    trailLength,
    heavyLength: Math.round(trailLength * BORDER_CHASE.heavyRatio),
    headLength: Math.round(trailLength * BORDER_CHASE.headRatio),
  };
}

export function chaseDistance(pathIndex: number, chase: BorderChase): number {
  return (chase.head - pathIndex + chase.perimeter) % chase.perimeter;
}

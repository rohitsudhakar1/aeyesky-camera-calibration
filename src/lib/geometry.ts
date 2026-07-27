import type { Point } from '../types';

export const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

export const clampPoint = (p: Point): Point => ({ x: clamp01(p.x), y: clamp01(p.y) });

export const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export const boundingBox = (points: Point[]): Rect => {
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return { x, y, width: Math.max(...xs) - x, height: Math.max(...ys) - y };
};

export const centroid = (points: Point[]): Point => ({
  x: points.reduce((s, p) => s + p.x, 0) / points.length,
  y: points.reduce((s, p) => s + p.y, 0) / points.length,
});

/** Ray-casting point-in-polygon test. Used for hit-testing a filled region. */
export const pointInPolygon = (pt: Point, poly: Point[]): boolean => {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i];
    const b = poly[j];
    const intersects =
      a.y > pt.y !== b.y > pt.y &&
      pt.x < ((b.x - a.x) * (pt.y - a.y)) / (b.y - a.y) + a.x;
    if (intersects) inside = !inside;
  }
  return inside;
};

/** Midpoints of every edge, including the implicit closing edge. */
export const edgeMidpoints = (points: Point[]): Point[] =>
  points.map((p, i) => {
    const next = points[(i + 1) % points.length];
    return { x: (p.x + next.x) / 2, y: (p.y + next.y) / 2 };
  });

/**
 * Shift a polygon by (dx, dy) but stop at the image edges, moving the whole
 * shape as a rigid body rather than letting individual vertices pile up on
 * the boundary.
 */
export const translatePolygon = (points: Point[], dx: number, dy: number): Point[] => {
  const box = boundingBox(points);
  const clampedDx = Math.min(1 - (box.x + box.width), Math.max(-box.x, dx));
  const clampedDy = Math.min(1 - (box.y + box.height), Math.max(-box.y, dy));
  return points.map((p) => ({ x: p.x + clampedDx, y: p.y + clampedDy }));
};

/**
 * Clamps a drag delta against the union of several polygons, so a multi-region
 * selection moves as one rigid body and stops when any edge of the group meets
 * the image boundary — rather than each polygon clamping independently, which
 * would deform the arrangement.
 */
export const clampGroupDelta = (polygons: Point[][], dx: number, dy: number) => {
  const box = boundingBox(polygons.flat());
  return {
    dx: Math.min(1 - (box.x + box.width), Math.max(-box.x, dx)),
    dy: Math.min(1 - (box.y + box.height), Math.max(-box.y, dy)),
  };
};

/** Short, human-quotable id in the style of the design (e.g. "23wpfu238"). */
export const generateId = (): string => {
  const alphabet = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let out = '';
  const bytes = crypto.getRandomValues(new Uint8Array(9));
  for (const b of bytes) out += alphabet[b % alphabet.length];
  return out;
};

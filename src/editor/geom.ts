/** Matriz afim [a, b, c, d, e, f] no mesmo formato do canvas (x' = a*x + c*y + e; y' = b*x + d*y + f). */
export type Mat = [number, number, number, number, number, number];
export type Pt = { x: number; y: number };
export type Box = { x: number; y: number; w: number; h: number };

export const IDENTITY: Mat = [1, 0, 0, 1, 0, 0];

export function mul(m: Mat, n: Mat): Mat {
  // m * n (aplica n primeiro, depois m)
  return [
    m[0] * n[0] + m[2] * n[1],
    m[1] * n[0] + m[3] * n[1],
    m[0] * n[2] + m[2] * n[3],
    m[1] * n[2] + m[3] * n[3],
    m[0] * n[4] + m[2] * n[5] + m[4],
    m[1] * n[4] + m[3] * n[5] + m[5],
  ];
}

export function invert(m: Mat): Mat {
  const det = m[0] * m[3] - m[1] * m[2] || 1e-9;
  return [m[3] / det, -m[1] / det, -m[2] / det, m[0] / det, (m[2] * m[5] - m[3] * m[4]) / det, (m[1] * m[4] - m[0] * m[5]) / det];
}

export function apply(m: Mat, p: Pt): Pt {
  return { x: m[0] * p.x + m[2] * p.y + m[4], y: m[1] * p.x + m[3] * p.y + m[5] };
}

export const translate = (x: number, y: number): Mat => [1, 0, 0, 1, x, y];
export const scaleAt = (sx: number, sy: number, o: Pt): Mat => [sx, 0, 0, sy, o.x - sx * o.x, o.y - sy * o.y];
export function rotateAt(rad: number, o: Pt): Mat {
  const c = Math.cos(rad);
  const s = Math.sin(rad);
  return [c, s, -s, c, o.x - c * o.x + s * o.y, o.y - s * o.x - c * o.y];
}

/** Fator de escala médio da matriz (para converter espessuras/raios). */
export function matScale(m: Mat) {
  return Math.sqrt(Math.abs(m[0] * m[3] - m[1] * m[2])) || 1;
}

export function boxCorners(b: Box): Pt[] {
  return [
    { x: b.x, y: b.y },
    { x: b.x + b.w, y: b.y },
    { x: b.x + b.w, y: b.y + b.h },
    { x: b.x, y: b.y + b.h },
  ];
}

export function boundsOf(pts: Pt[]): Box {
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;
  for (const p of pts) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  if (!isFinite(minX)) return { x: 0, y: 0, w: 0, h: 0 };
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}

export function unionBox(boxes: Box[]): Box {
  return boundsOf(boxes.flatMap(boxCorners));
}

export function transformBox(m: Mat, b: Box): Box {
  return boundsOf(boxCorners(b).map((p) => apply(m, p)));
}

export function inBox(p: Pt, b: Box, pad = 0) {
  return p.x >= b.x - pad && p.x <= b.x + b.w + pad && p.y >= b.y - pad && p.y <= b.y + b.h + pad;
}

export function boxesIntersect(a: Box, b: Box) {
  return a.x <= b.x + b.w && a.x + a.w >= b.x && a.y <= b.y + b.h && a.y + a.h >= b.y;
}

export function distToSegment(p: Pt, a: Pt, b: Pt) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = dx * dx + dy * dy;
  let t = len ? ((p.x - a.x) * dx + (p.y - a.y) * dy) / len : 0;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

export function pointInPolygon(p: Pt, poly: Pt[]) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i];
    const b = poly[j];
    if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

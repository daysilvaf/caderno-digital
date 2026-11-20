import { getStroke } from 'perfect-freehand';
import { getImage } from '../assets';
import type { Box, Mat, Pt } from './geom';
import { apply, boundsOf, distToSegment, IDENTITY, invert, matScale, transformBox } from './geom';

export type PenKind = 'caneta' | 'lapis' | 'marcatexto';
export type ShapeKind = 'linha' | 'seta' | 'retangulo' | 'elipse' | 'triangulo' | 'losango' | 'hexagono';
export type FontKind = 'sans' | 'mao' | 'serif';

interface Base {
  id: string;
  m: Mat; // transformação (mover, redimensionar, girar)
  opacity: number;
}

export interface StrokeEl extends Base {
  type: 'stroke';
  pen: PenKind;
  color: string;
  size: number;
  /** [x, y, pressão] */
  points: number[][];
  /** true quando a pressão veio de uma caneta real (stylus) */
  real: boolean;
}

export interface ShapeEl extends Base {
  type: 'shape';
  kind: ShapeKind;
  color: string;
  fill: string | null;
  size: number;
  /** Para linha/seta: ponto inicial e final. Para as outras: caixa. */
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  /** raio dos cantos do retângulo (padrão: 6) */
  radius?: number;
}

export interface TextEl extends Base {
  type: 'text';
  text: string;
  color: string;
  fontSize: number;
  font: FontKind;
  x: number;
  y: number;
  w: number;
  /** alinhamento das linhas dentro da largura (padrão: esquerda) */
  align?: 'left' | 'center';
}

export interface ImageEl extends Base {
  type: 'image';
  assetId: string;
  x: number;
  y: number;
  w: number;
  h: number;
  /** recorte visível da imagem original, em frações (0 a 1) */
  crop: { x: number; y: number; w: number; h: number };
}

export interface LinkEl extends Base {
  type: 'link';
  x: number;
  y: number;
  label: string;
  url?: string; // link da internet
  assetId?: string; // documento guardado no caderno
  color: string;
}

export type El = StrokeEl | ShapeEl | TextEl | ImageEl | LinkEl;

export const FULL_CROP = { x: 0, y: 0, w: 1, h: 1 };
const LINK_H = 34;
const LINK_FONT = '500 15px Inter, system-ui, sans-serif';

export const FONT_FAMILY: Record<FontKind, string> = {
  sans: "Inter, system-ui, sans-serif",
  mao: "Caveat, 'Comic Sans MS', cursive",
  serif: "Fraunces, Georgia, serif",
};
export const LINE_HEIGHT = 1.3;

// ---------------- Traços ----------------

export function strokeOutline(el: StrokeEl, last = true) {
  const hl = el.pen === 'marcatexto';
  return getStroke(el.points, {
    size: el.size,
    thinning: hl ? 0 : el.pen === 'lapis' ? 0.25 : 0.55,
    smoothing: 0.5,
    streamline: hl ? 0.6 : 0.45,
    simulatePressure: !el.real && !hl,
    start: { taper: hl ? 0 : 0, cap: true },
    end: { taper: 0, cap: true },
    last,
  });
}

export function outlineToPath(pts: number[][]) {
  const p = new Path2D();
  if (pts.length < 2) return p;
  p.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length - 1; i++) {
    const [x0, y0] = pts[i];
    const [x1, y1] = pts[i + 1];
    p.quadraticCurveTo(x0, y0, (x0 + x1) / 2, (y0 + y1) / 2);
  }
  p.closePath();
  return p;
}

// Cache pela lista de pontos: mover/girar cria um novo objeto, mas reaproveita os pontos.
// Quem muda espessura ou caneta deve copiar a lista (points.slice()).
const pathCache = new WeakMap<number[][], Path2D>();
function strokePath(el: StrokeEl) {
  let p = pathCache.get(el.points);
  if (!p) {
    p = outlineToPath(strokeOutline(el));
    pathCache.set(el.points, p);
  }
  return p;
}

// Textura de grafite para o lápis.
const pencilPatterns = new Map<string, CanvasPattern | null>();
function pencilPattern(ctx: CanvasRenderingContext2D, color: string) {
  if (pencilPatterns.has(color)) return pencilPatterns.get(color)!;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d')!;
  g.fillStyle = color;
  let seed = 7;
  const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 64 * 64 * 0.85; i++) {
    g.globalAlpha = 0.55 + rand() * 0.45;
    g.fillRect(Math.floor(rand() * 64), Math.floor(rand() * 64), 1, 1);
  }
  const pat = ctx.createPattern(c, 'repeat');
  pencilPatterns.set(color, pat);
  return pat;
}

// ---------------- Formas ----------------

function shapePath(el: ShapeEl) {
  const p = new Path2D();
  const x = Math.min(el.x1, el.x2);
  const y = Math.min(el.y1, el.y2);
  const w = Math.abs(el.x2 - el.x1);
  const h = Math.abs(el.y2 - el.y1);
  switch (el.kind) {
    case 'linha':
    case 'seta': {
      p.moveTo(el.x1, el.y1);
      p.lineTo(el.x2, el.y2);
      if (el.kind === 'seta') {
        const ang = Math.atan2(el.y2 - el.y1, el.x2 - el.x1);
        const len = Math.max(12, el.size * 4);
        for (const s of [-1, 1]) {
          p.moveTo(el.x2, el.y2);
          p.lineTo(el.x2 - len * Math.cos(ang + (s * Math.PI) / 7), el.y2 - len * Math.sin(ang + (s * Math.PI) / 7));
        }
      }
      break;
    }
    case 'retangulo':
      p.roundRect(x, y, w, h, Math.min(el.radius ?? 6, w / 2, h / 2));
      break;
    case 'elipse':
      p.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, 0, 0, Math.PI * 2);
      break;
    case 'triangulo':
      p.moveTo(x + w / 2, y);
      p.lineTo(x + w, y + h);
      p.lineTo(x, y + h);
      p.closePath();
      break;
    case 'losango':
      p.moveTo(x + w / 2, y);
      p.lineTo(x + w, y + h / 2);
      p.lineTo(x + w / 2, y + h);
      p.lineTo(x, y + h / 2);
      p.closePath();
      break;
    case 'hexagono': {
      // anel (ex.: benzeno) com vértice para cima
      const cx = x + w / 2;
      const cy = y + h / 2;
      for (let i = 0; i < 6; i++) {
        const a = -Math.PI / 2 + (i * Math.PI) / 3;
        const px = cx + (w / 2) * Math.cos(a);
        const py = cy + (h / 2) * Math.sin(a);
        if (i === 0) p.moveTo(px, py);
        else p.lineTo(px, py);
      }
      p.closePath();
      break;
    }
  }
  return p;
}

// ---------------- Texto ----------------

let measureCtx: CanvasRenderingContext2D | null = null;
export function textFont(el: Pick<TextEl, 'fontSize' | 'font'>) {
  return `${el.font === 'mao' ? 600 : 400} ${el.fontSize}px ${FONT_FAMILY[el.font]}`;
}

export function wrapText(el: TextEl): string[] {
  measureCtx ??= document.createElement('canvas').getContext('2d')!;
  measureCtx.font = textFont(el);
  const lines: string[] = [];
  for (const para of el.text.split('\n')) {
    const words = para.split(/(\s+)/);
    let line = '';
    for (const w of words) {
      const test = line + w;
      if (measureCtx.measureText(test).width > el.w && line.trim()) {
        lines.push(line.trimEnd());
        line = w.trimStart();
      } else line = test;
    }
    lines.push(line);
  }
  return lines;
}

// ---------------- Caixas e desenho ----------------

const localBoxCache = new WeakMap<object, Box>();
export function localBox(el: El): Box {
  const key = el.type === 'stroke' ? el.points : el;
  const cached = localBoxCache.get(key);
  if (cached) return cached;
  let b: Box;
  if (el.type === 'stroke') {
    const r = el.size / 2;
    const bb = boundsOf(el.points.map(([x, y]) => ({ x, y })));
    b = { x: bb.x - r, y: bb.y - r, w: bb.w + 2 * r, h: bb.h + 2 * r };
  } else if (el.type === 'shape') {
    const r = el.size / 2 + (el.kind === 'seta' ? el.size * 3 : 0);
    const bb = boundsOf([
      { x: el.x1, y: el.y1 },
      { x: el.x2, y: el.y2 },
    ]);
    b = { x: bb.x - r, y: bb.y - r, w: bb.w + 2 * r, h: bb.h + 2 * r };
  } else if (el.type === 'image') {
    b = { x: el.x, y: el.y, w: el.w, h: el.h };
  } else if (el.type === 'link') {
    b = { x: el.x, y: el.y, w: linkWidth(el), h: LINK_H };
  } else {
    const lines = wrapText(el);
    b = { x: el.x, y: el.y, w: el.w, h: Math.max(1, lines.length) * el.fontSize * LINE_HEIGHT };
  }
  localBoxCache.set(key, b);
  return b;
}

function linkWidth(el: LinkEl) {
  measureCtx ??= document.createElement('canvas').getContext('2d')!;
  measureCtx.font = LINK_FONT;
  return Math.min(520, measureCtx.measureText(el.label).width) + 52;
}

export function elBox(el: El): Box {
  return transformBox(el.m, localBox(el));
}

export function drawElement(ctx: CanvasRenderingContext2D, el: El) {
  ctx.save();
  ctx.transform(...el.m);
  ctx.globalAlpha = el.opacity;
  if (el.type === 'stroke') {
    ctx.fillStyle = el.pen === 'lapis' ? (pencilPattern(ctx, el.color) ?? el.color) : el.color;
    ctx.fill(strokePath(el));
  } else if (el.type === 'shape') {
    const p = shapePath(el);
    if (el.fill && el.kind !== 'linha' && el.kind !== 'seta') {
      ctx.fillStyle = el.fill;
      ctx.fill(p);
    }
    ctx.strokeStyle = el.color;
    ctx.lineWidth = el.size;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke(p);
  } else if (el.type === 'image') {
    const img = getImage(el.assetId);
    if (img) {
      const nw = img.naturalWidth || el.w;
      const nh = img.naturalHeight || el.h;
      const c = el.crop;
      ctx.drawImage(img, c.x * nw, c.y * nh, c.w * nw, c.h * nh, el.x, el.y, el.w, el.h);
    } else {
      ctx.fillStyle = 'rgba(185,167,232,0.12)';
      ctx.fillRect(el.x, el.y, el.w, el.h);
    }
  } else if (el.type === 'link') {
    const w = linkWidth(el);
    ctx.beginPath();
    ctx.roundRect(el.x, el.y, w, LINK_H, LINK_H / 2);
    ctx.fillStyle = el.color + '33';
    ctx.fill();
    ctx.strokeStyle = el.color;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    // ícone: clipe (documento) ou corrente (link)
    ctx.save();
    ctx.translate(el.x + 14, el.y + LINK_H / 2);
    ctx.strokeStyle = el.color;
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.beginPath();
    if (el.assetId) {
      ctx.moveTo(4, -2);
      ctx.lineTo(-2, 4);
      ctx.arc(-4, 2, 3, Math.PI * 0.25, Math.PI * 1.25);
      ctx.lineTo(4, -8);
      ctx.arc(6, -6, 3, Math.PI * 1.25, Math.PI * 0.25);
      ctx.lineTo(0, 6);
    } else {
      ctx.roundRect(-7, -3, 8, 6, 3);
      ctx.roundRect(-1, -3, 8, 6, 3);
    }
    ctx.stroke();
    ctx.restore();
    ctx.fillStyle = el.color;
    ctx.font = LINK_FONT;
    ctx.textBaseline = 'middle';
    let label = el.label;
    if (ctx.measureText(label).width > 520) {
      while (label.length > 3 && ctx.measureText(label + '…').width > 520) label = label.slice(0, -1);
      label += '…';
    }
    ctx.fillText(label, el.x + 32, el.y + LINK_H / 2 + 1);
  } else {
    ctx.fillStyle = el.color;
    ctx.font = textFont(el);
    ctx.textBaseline = 'top';
    const lh = el.fontSize * LINE_HEIGHT;
    const pad = (lh - el.fontSize) / 2;
    wrapText(el).forEach((line, i) => {
      const dx = el.align === 'center' ? Math.max(0, (el.w - ctx.measureText(line).width) / 2) : 0;
      ctx.fillText(line, el.x + dx, el.y + pad + i * lh);
    });
  }
  ctx.restore();
}

/** Desenha os elementos: marca-texto por baixo da tinta, como num caderno de papel. */
export function drawElements(ctx: CanvasRenderingContext2D, els: El[], skip?: Set<string>) {
  for (const pass of [0, 1]) {
    for (const el of els) {
      if (skip?.has(el.id)) continue;
      const hl = el.type === 'stroke' && el.pen === 'marcatexto';
      if ((pass === 0) === hl) drawElement(ctx, el);
    }
  }
}

// ---------------- Acerto do clique ----------------

export function hitTest(el: El, p: Pt, tol = 6): boolean {
  if (!inLooseBox(el, p, tol)) return false;
  const inv = invert(el.m);
  const lp = apply(inv, p);
  const t = tol / matScale(el.m);
  if (el.type === 'stroke') {
    const r = el.size / 2 + t;
    const pts = el.points;
    if (pts.length === 1) return Math.hypot(pts[0][0] - lp.x, pts[0][1] - lp.y) <= r;
    for (let i = 1; i < pts.length; i++) {
      if (distToSegment(lp, { x: pts[i - 1][0], y: pts[i - 1][1] }, { x: pts[i][0], y: pts[i][1] }) <= r) return true;
    }
    return false;
  }
  if (el.type === 'shape') {
    if (el.kind === 'linha' || el.kind === 'seta') return distToSegment(lp, { x: el.x1, y: el.y1 }, { x: el.x2, y: el.y2 }) <= el.size / 2 + t;
    measureCtx ??= document.createElement('canvas').getContext('2d')!;
    const path = shapePath(el);
    measureCtx.lineWidth = el.size + t * 2;
    return measureCtx.isPointInStroke(path, lp.x, lp.y) || (!!el.fill && measureCtx.isPointInPath(path, lp.x, lp.y));
  }
  const b = localBox(el);
  return lp.x >= b.x - t && lp.x <= b.x + b.w + t && lp.y >= b.y - t && lp.y <= b.y + b.h + t;
}

function inLooseBox(el: El, p: Pt, tol: number) {
  const b = elBox(el);
  return p.x >= b.x - tol && p.x <= b.x + b.w + tol && p.y >= b.y - tol && p.y <= b.y + b.h + tol;
}

/** Pontos representativos do elemento (em coordenadas da página), usados pelo laço. */
export function samplePoints(el: El): Pt[] {
  if (el.type === 'stroke') {
    const step = Math.max(1, Math.floor(el.points.length / 40));
    const out: Pt[] = [];
    for (let i = 0; i < el.points.length; i += step) out.push(apply(el.m, { x: el.points[i][0], y: el.points[i][1] }));
    return out;
  }
  const b = localBox(el);
  return [
    { x: b.x + b.w / 2, y: b.y + b.h / 2 },
    { x: b.x + b.w * 0.25, y: b.y + b.h * 0.25 },
    { x: b.x + b.w * 0.75, y: b.y + b.h * 0.75 },
  ].map((q) => apply(el.m, q));
}

/**
 * Borracha de precisão: remove os pontos do traço que estão dentro do raio
 * e divide o traço em pedaços. Retorna null se não tocou no traço.
 */
export function eraseFromStroke(el: StrokeEl, p: Pt, radius: number, newId: () => string): StrokeEl[] | null {
  const lp = apply(invert(el.m), p);
  const r = radius / matScale(el.m) + el.size / 2;
  let touched = false;
  const pieces: number[][][] = [];
  let cur: number[][] = [];
  const pts = el.points;
  for (let i = 0; i < pts.length; i++) {
    const hit =
      Math.hypot(pts[i][0] - lp.x, pts[i][1] - lp.y) <= r ||
      (i > 0 && distToSegment(lp, { x: pts[i - 1][0], y: pts[i - 1][1] }, { x: pts[i][0], y: pts[i][1] }) <= r * 0.6);
    if (hit) {
      touched = true;
      if (cur.length) pieces.push(cur);
      cur = [];
    } else cur.push(pts[i]);
  }
  if (cur.length) pieces.push(cur);
  if (!touched) return null;
  return pieces.filter((pc) => pc.length > 1).map((pc, i) => ({ ...el, id: i === 0 ? el.id : newId(), points: pc }));
}

export const withMatrix = <T extends El>(el: T, m: Mat): T => ({ ...el, m });
export { IDENTITY };

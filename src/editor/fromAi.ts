import { nanoid } from 'nanoid';
import type { AiItem } from '../ai';
import { isDark } from '../paper';
import type { El, ImageEl, ShapeEl, StrokeEl, TextEl } from './elements';

/*
 * Converte os itens lidos pela IA em elementos do caderno, com cara de escrito à mão:
 * texto na letra cursiva, contornos e setas como traços de caneta levemente tremidos,
 * figuras recortadas da própria imagem (já sem fundo).
 */

interface Target {
  /** caixa da imagem original na página (coordenadas locais, antes da transformação m) */
  x: number;
  y: number;
  w: number;
  h: number;
  m: ImageEl['m'];
  /** recorte visível da imagem original */
  crop: ImageEl['crop'];
  /** imagem sem fundo, usada para as figuras */
  inkAssetId: string;
  /** cor do papel da página */
  paper: string;
  /** cor de tinta padrão do papel */
  ink: string;
}

const HEX = /^#[0-9a-f]{6}$/i;

function luminance(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  const c = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}

/** Ajusta a cor para continuar legível no papel (tinta preta vira clara em papel escuro, e vice-versa). */
function readable(color: string, t: Target) {
  if (!HEX.test(color)) return t.ink;
  const darkPaper = isDark(t.paper);
  const l = luminance(color);
  if (darkPaper && l < 0.12) return t.ink;
  if (!darkPaper && l > 0.75) return t.ink;
  return color;
}

// Gerador pseudoaleatório estável (o mesmo item sempre treme do mesmo jeito).
function rng(seed: number) {
  let s = Math.floor(seed * 9301 + 49297) % 233280 || 1;
  return () => {
    s = (s * 16807) % 2147483647;
    return s / 2147483647;
  };
}

/** Pontos de uma linha "à mão": densa, com uma ondulação suave e pressão variando. */
function handLine(pts: { x: number; y: number }[], wobble: number, rand: () => number): number[][] {
  const out: number[][] = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i];
    const b = pts[i + 1];
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    const n = Math.max(2, Math.round(len / 4));
    const nx = -(b.y - a.y) / (len || 1);
    const ny = (b.x - a.x) / (len || 1);
    const amp = Math.min(wobble, len * 0.02) * (0.5 + rand());
    const phase = rand() * Math.PI * 2;
    for (let k = i === 0 ? 0 : 1; k <= n; k++) {
      const t = k / n;
      const off = Math.sin(t * Math.PI) * amp * Math.sin(phase + t * 2.2);
      out.push([a.x + (b.x - a.x) * t + nx * off, a.y + (b.y - a.y) * t + ny * off, 0.5]);
    }
  }
  return out;
}

function stroke(points: number[][], color: string, size: number, pen: StrokeEl['pen'] = 'caneta', opacity = 1): StrokeEl {
  return { id: nanoid(), type: 'stroke', pen, color, size, points, real: false, m: [1, 0, 0, 1, 0, 0], opacity };
}

export function itemsToElements(items: AiItem[], t: Target): El[] {
  const sx = t.w / 1000;
  const sy = t.h / 1000;
  const X = (v: number) => t.x + Math.max(0, Math.min(1000, v)) * sx;
  const Y = (v: number) => t.y + Math.max(0, Math.min(1000, v)) * sy;
  const pen = Math.max(1.6, Math.min(4, t.w / 260));

  const back: El[] = []; // marca-texto e preenchimentos
  const figs: El[] = [];
  const lines: El[] = [];
  const texts: El[] = [];

  items.forEach((it, idx) => {
    const rand = rng(idx + 1);
    const color = readable(it.cor, t);
    const x = X(it.x);
    const y = Y(it.y);
    const w = Math.max(4, it.largura * sx);
    const h = Math.max(4, it.altura * sy);

    switch (it.tipo) {
      case 'texto': {
        const txt = it.texto.trim();
        if (!txt) return;
        // A letra cursiva é mais estreita e baixa que a original: aumenta um pouco.
        const fs = Math.max(11, Math.min(96, (it.tamanho || 18) * sy * 1.25));
        const el: TextEl = { id: nanoid(), type: 'text', text: txt, color, fontSize: Math.round(fs), font: 'mao', x, y: y - fs * 0.1, w: Math.max(w * 1.12, fs * 2), m: [1, 0, 0, 1, 0, 0], opacity: 1 };
        texts.push(el);
        return;
      }
      case 'seta':
      case 'linha': {
        const a = { x, y };
        const b = { x: X(it.x2), y: Y(it.y2) };
        const len = Math.hypot(b.x - a.x, b.y - a.y);
        if (len < 3) return;
        const pts = [a, b];
        if (it.tipo === 'seta') {
          const ang = Math.atan2(b.y - a.y, b.x - a.x);
          const head = Math.min(18, Math.max(8, len * 0.25));
          const l = { x: b.x - head * Math.cos(ang - 0.45), y: b.y - head * Math.sin(ang - 0.45) };
          const r = { x: b.x - head * Math.cos(ang + 0.45), y: b.y - head * Math.sin(ang + 0.45) };
          pts.push(l, b, r);
        }
        lines.push(stroke(handLine(pts, 3, rand), color, pen));
        return;
      }
      case 'retangulo':
      case 'losango':
      case 'elipse': {
        let pts: { x: number; y: number }[];
        if (it.tipo === 'retangulo') {
          const o = Math.min(6, w * 0.03); // a ponta passa um pouco do início, como à mão
          pts = [
            { x: x + o, y },
            { x: x + w, y },
            { x: x + w, y: y + h },
            { x, y: y + h },
            { x, y },
            { x: x + o * 2, y: y + 1 },
          ];
        } else if (it.tipo === 'losango') {
          pts = [
            { x: x + w / 2, y },
            { x: x + w, y: y + h / 2 },
            { x: x + w / 2, y: y + h },
            { x, y: y + h / 2 },
            { x: x + w / 2, y },
          ];
        } else {
          pts = [];
          const n = 40;
          const start = rand() * Math.PI * 2;
          for (let k = 0; k <= n + 3; k++) {
            const a = start + (k / n) * Math.PI * 2;
            const j = 1 + (rand() - 0.5) * 0.03;
            pts.push({ x: x + w / 2 + (Math.cos(a) * w * j) / 2, y: y + h / 2 + (Math.sin(a) * h * j) / 2 });
          }
        }
        if (HEX.test(it.fundo)) {
          const fill: ShapeEl = {
            id: nanoid(),
            type: 'shape',
            kind: it.tipo,
            color: it.fundo + '00',
            fill: it.fundo + '59',
            size: 1,
            x1: x,
            y1: y,
            x2: x + w,
            y2: y + h,
            m: [1, 0, 0, 1, 0, 0],
            opacity: 1,
          };
          back.push(fill);
        }
        if (HEX.test(it.cor)) lines.push(stroke(handLine(pts, it.tipo === 'elipse' ? 0 : 2.5, rand), color, pen));
        return;
      }
      case 'marcatexto': {
        const c = HEX.test(it.cor) ? it.cor : '#f5e1a4';
        const size = Math.max(8, h * 0.9);
        back.push(stroke(handLine([{ x: x + size * 0.2, y: y + h / 2 }, { x: x + w - size * 0.2, y: y + h / 2 }], 1.5, rand), c, size, 'marcatexto', 0.55));
        return;
      }
      case 'figura': {
        if (w < 6 || h < 6) return;
        const cr = t.crop;
        const fx = (it.x / 1000) * cr.w;
        const fy = (it.y / 1000) * cr.h;
        const fw = (Math.min(1000 - it.x, it.largura) / 1000) * cr.w;
        const fh = (Math.min(1000 - it.y, it.altura) / 1000) * cr.h;
        const img: ImageEl = {
          id: nanoid(),
          type: 'image',
          assetId: t.inkAssetId,
          x,
          y,
          w: (fw / cr.w) * t.w,
          h: (fh / cr.h) * t.h,
          crop: { x: cr.x + fx, y: cr.y + fy, w: fw, h: fh },
          m: [1, 0, 0, 1, 0, 0],
          opacity: 1,
        };
        figs.push(img);
        return;
      }
    }
  });

  // Tudo herda a posição/rotação da imagem original.
  return [...back, ...figs, ...lines, ...texts].map((el) => ({ ...el, m: t.m }));
}

import type { PageTemplate } from './types';
import { PAPER_COLORS } from './types';

export const GRID = 32;

/** Retorna cor de fundo, cor das linhas e cor de tinta padrão do papel. */
export function paperColors(t: PageTemplate) {
  if (t.color === 'custom') {
    const bg = t.customColor ?? '#20202a';
    const dark = isDark(bg);
    return {
      bg,
      ink: dark ? '#f2eefa' : '#1d1d22',
      line: dark ? 'rgba(255,255,255,0.10)' : 'rgba(40,40,60,0.14)',
    };
  }
  return PAPER_COLORS[t.color];
}

export function isDark(hex: string) {
  const m = hex.replace('#', '');
  const full = m.length === 3 ? m.split('').map((c) => c + c).join('') : m;
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b < 140;
}

/** Desenha o fundo do papel no contexto, em coordenadas da página (já escalado pelo chamador). */
export function drawPaper(ctx: CanvasRenderingContext2D, t: PageTemplate, w: number, h: number) {
  const c = paperColors(t);
  ctx.save();
  ctx.fillStyle = c.bg;
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = c.line;
  ctx.fillStyle = c.line;
  ctx.lineWidth = 1;
  if (t.pattern === 'quadriculado') {
    ctx.beginPath();
    for (let x = GRID; x < w; x += GRID) {
      ctx.moveTo(x + 0.5, 0);
      ctx.lineTo(x + 0.5, h);
    }
    for (let y = GRID; y < h; y += GRID) {
      ctx.moveTo(0, y + 0.5);
      ctx.lineTo(w, y + 0.5);
    }
    ctx.stroke();
  } else if (t.pattern === 'pontilhado') {
    const r = 1.4;
    for (let x = GRID; x < w; x += GRID) {
      for (let y = GRID; y < h; y += GRID) {
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  } else if (t.pattern === 'linhas') {
    ctx.beginPath();
    for (let y = GRID * 3; y < h - GRID; y += GRID) {
      ctx.moveTo(48, y + 0.5);
      ctx.lineTo(w - 48, y + 0.5);
    }
    ctx.stroke();
  }
  ctx.restore();
}

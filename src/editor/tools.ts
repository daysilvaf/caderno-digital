import { useEffect, useState } from 'react';
import type { FontKind, ShapeKind } from './elements';

export type Tool = 'selecao' | 'laco' | 'caneta' | 'lapis' | 'marcatexto' | 'borracha' | 'texto' | 'forma' | 'mao';

export interface PenSettings {
  color: string;
  size: number;
  opacity: number;
}

export interface ToolSettings {
  caneta: PenSettings;
  lapis: PenSettings;
  marcatexto: PenSettings;
  borracha: { mode: 'traco' | 'precisao'; size: number };
  forma: { kind: ShapeKind; color: string; size: number; opacity: number; fill: boolean };
  texto: { color: string; fontSize: number; font: FontKind };
}

export const INK_COLORS = ['#f5f3fa', '#1d1d22', '#b9a7e8', '#d7b8f3', '#f4b8cf', '#a9cdf2', '#b4e3c4', '#f5e1a4', '#f6a58c'];
export const HIGHLIGHT_COLORS = ['#f5e1a4', '#f4b8cf', '#b4e3c4', '#a9cdf2', '#d7b8f3', '#f6a58c'];

export const SIZE_PRESETS: Record<'caneta' | 'lapis' | 'marcatexto' | 'forma' | 'borracha', number[]> = {
  caneta: [2, 3.5, 6],
  lapis: [2, 3, 5],
  marcatexto: [14, 22, 32],
  forma: [2, 3.5, 6],
  borracha: [10, 22, 44],
};

export const DEFAULT_SETTINGS: ToolSettings = {
  caneta: { color: '#f5f3fa', size: 3.5, opacity: 1 },
  lapis: { color: '#d7b8f3', size: 3, opacity: 0.9 },
  marcatexto: { color: '#f5e1a4', size: 22, opacity: 0.4 },
  borracha: { mode: 'traco', size: 22 },
  forma: { kind: 'retangulo', color: '#a9cdf2', size: 3, opacity: 1, fill: false },
  texto: { color: '#f5f3fa', fontSize: 22, font: 'sans' },
};

export const TOOL_LABEL: Record<Tool, string> = {
  selecao: 'Selecionar (V)',
  laco: 'Laço (L)',
  caneta: 'Caneta (P)',
  lapis: 'Lápis (B)',
  marcatexto: 'Marca-texto (H)',
  borracha: 'Borracha (E)',
  texto: 'Texto (T)',
  forma: 'Formas (S)',
  mao: 'Mão: mover a folha (espaço)',
};

export const SHAPE_LABEL: Record<ShapeKind, string> = {
  linha: 'Linha',
  seta: 'Seta',
  retangulo: 'Retângulo',
  elipse: 'Círculo / elipse',
  triangulo: 'Triângulo',
  losango: 'Losango',
  hexagono: 'Hexágono (anel)',
};

function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    const v = JSON.parse(raw);
    return typeof fallback === 'object' && fallback && !Array.isArray(fallback) ? { ...fallback, ...v } : v;
  } catch {
    return fallback;
  }
}
function save(key: string, v: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(v));
  } catch {
    /* sem armazenamento */
  }
}

/** Ferramenta atual e ajustes de cada ferramenta, lembrados entre sessões. */
export function useToolState() {
  const [tool, setTool] = useState<Tool>(() => load<Tool>('caderno:ferramenta', 'caneta'));
  const [settings, setSettings] = useState<ToolSettings>(() => load('caderno:ajustes', DEFAULT_SETTINGS));
  useEffect(() => save('caderno:ferramenta', tool === 'mao' ? 'caneta' : tool), [tool]);
  useEffect(() => save('caderno:ajustes', settings), [settings]);
  return { tool, setTool, settings, setSettings };
}

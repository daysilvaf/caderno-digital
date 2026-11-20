import { useEffect, useRef } from 'react';
import { drawPaper } from '../paper';
import type { PageTemplate } from '../types';

interface Props {
  template: PageTemplate;
  width: number; // tamanho lógico da página
  height: number;
  scale: number; // escala visual (zoom ou miniatura)
  className?: string;
  style?: React.CSSProperties;
}

/** Canvas que desenha o fundo do papel em alta definição para a escala pedida. */
export function PaperCanvas({ template, width, height, scale, className, style }: Props) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const k = scale * dpr;
    c.width = Math.max(1, Math.round(width * k));
    c.height = Math.max(1, Math.round(height * k));
    const ctx = c.getContext('2d')!;
    ctx.setTransform(k, 0, 0, k, 0, 0);
    drawPaper(ctx, template, width, height);
  }, [template, width, height, scale]);
  return <canvas ref={ref} className={className} style={{ width: width * scale, height: height * scale, ...style }} />;
}

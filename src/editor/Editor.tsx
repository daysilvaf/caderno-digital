import { nanoid } from 'nanoid';
import { forwardRef, useCallback, useEffect, useImperativeHandle, useLayoutEffect, useRef, useState } from 'react';
import { updatePage } from '../db';
import { paperColors } from '../paper';
import type { Page } from '../types';
import type { El, ShapeEl, StrokeEl, TextEl } from './elements';
import { drawElement, drawElements, elBox, eraseFromStroke, FONT_FAMILY, hitTest, IDENTITY, LINE_HEIGHT, samplePoints } from './elements';
import type { Box, Mat, Pt } from './geom';
import { apply, boxCorners, boxesIntersect, inBox, matScale, mul, pointInPolygon, rotateAt, scaleAt, translate, unionBox } from './geom';
import type { Tool, ToolSettings } from './tools';

export interface EditorStatus {
  canUndo: boolean;
  canRedo: boolean;
  selected: number;
  canPaste: boolean;
}

export interface EditorApi {
  undo(): void;
  redo(): void;
  copy(): void;
  cut(): void;
  paste(): void;
  duplicate(): void;
  remove(): void;
  selectAll(): void;
  clearSelection(): void;
  bringToFront(): void;
  sendToBack(): void;
  /** Aplica cor/espessura/opacidade aos elementos selecionados. */
  applyStyle(style: { color?: string; size?: number; opacity?: number }): void;
}

interface Props {
  page: Page;
  scale: number;
  tool: Tool;
  settings: ToolSettings;
  onStatus: (s: EditorStatus) => void;
  onToolChange: (t: Tool) => void;
}

// Área de transferência interna (vale entre páginas e aulas).
let clipboard: El[] = [];
let pasteCount = 0;

const HANDLE = 9; // tamanho da alça em pixels de tela
const ROT_OFFSET = 26;
const MAX_PIXELS = 18_000_000; // limite de pixels do canvas (memória)

type Interaction =
  | { kind: 'none' }
  | { kind: 'stroke'; el: StrokeEl }
  | { kind: 'shape'; el: ShapeEl; start: Pt }
  | { kind: 'erase'; changed: boolean; before: El[] }
  | { kind: 'lasso'; pts: Pt[] }
  | { kind: 'marquee'; start: Pt; cur: Pt; add: boolean }
  | { kind: 'move'; start: Pt; d: Mat; dup: boolean }
  | { kind: 'scale'; start: Pt; anchor: Pt; d: Mat }
  | { kind: 'rotate'; start: Pt; center: Pt; d: Mat }
  | { kind: 'pan'; sx: number; sy: number; left: number; top: number };

type Handle = 'nw' | 'ne' | 'se' | 'sw' | 'rot';

export const Editor = forwardRef<EditorApi, Props>(function Editor({ page, scale, tool, settings, onStatus, onToolChange }, ref) {
  const [elements, setElements] = useState<El[]>(() => (page.elements as El[]) ?? []);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [editing, setEditing] = useState<{ id: string; isNew: boolean } | null>(null);
  const past = useRef<El[][]>([]);
  const future = useRef<El[][]>([]);
  const elsRef = useRef(elements);
  elsRef.current = elements;
  const selRef = useRef(selected);
  selRef.current = selected;
  const ix = useRef<Interaction>({ kind: 'none' });
  const hover = useRef<Pt | null>(null);
  const penSeen = useRef(false);
  const spaceDown = useRef(false);
  const dirty = useRef(false);

  const wrapRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);

  const W = page.width;
  const H = page.height;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  // Resolução do canvas, limitada para não estourar a memória em zoom alto.
  const k = Math.min(scale * dpr, Math.sqrt(MAX_PIXELS / (W * H)));
  const ink = paperColors(page.template).ink;

  // ---------- histórico ----------
  const commit = useCallback((next: El[]) => {
    past.current.push(elsRef.current);
    if (past.current.length > 150) past.current.shift();
    future.current = [];
    elsRef.current = next;
    dirty.current = true;
    setElements(next);
  }, []);

  const undo = useCallback(() => {
    const prev = past.current.pop();
    if (!prev) return;
    future.current.push(elsRef.current);
    elsRef.current = prev;
    dirty.current = true;
    setElements(prev);
    setSelected((s) => new Set([...s].filter((id) => prev.some((e) => e.id === id))));
  }, []);

  const redo = useCallback(() => {
    const next = future.current.pop();
    if (!next) return;
    past.current.push(elsRef.current);
    elsRef.current = next;
    dirty.current = true;
    setElements(next);
  }, []);

  // ---------- salvamento automático ----------
  const pageRef = useRef(page);
  pageRef.current = page;
  const persist = useCallback(() => {
    if (!dirty.current) return;
    dirty.current = false;
    const els = elsRef.current;
    const p = pageRef.current;
    updatePage(p.id, { elements: els as Page['elements'], thumbnail: renderThumbnail(p, els) });
  }, []);

  useEffect(() => {
    if (!dirty.current) return;
    const t = window.setTimeout(persist, 450);
    return () => window.clearTimeout(t);
  }, [elements, persist]);

  useEffect(() => {
    const flush = () => persist();
    window.addEventListener('beforeunload', flush);
    document.addEventListener('visibilitychange', flush);
    return () => {
      window.removeEventListener('beforeunload', flush);
      document.removeEventListener('visibilitychange', flush);
      flush(); // ao trocar de página
    };
  }, [persist]);

  // ---------- status para a barra de ferramentas ----------
  useEffect(() => {
    onStatus({ canUndo: past.current.length > 0, canRedo: future.current.length > 0, selected: selected.size, canPaste: clipboard.length > 0 });
  }, [elements, selected, onStatus]);

  // Trocar de ferramenta limpa a seleção (exceto entre laço e seleção).
  useEffect(() => {
    if (tool !== 'selecao' && tool !== 'laco') setSelected(new Set());
  }, [tool]);

  // ---------- desenho ----------
  const selectedEls = useCallback(() => elsRef.current.filter((e) => selRef.current.has(e.id)), []);

  const renderContent = useCallback(() => {
    const c = contentRef.current;
    if (!c) return;
    const ctx = c.getContext('2d')!;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, c.width, c.height);
    ctx.setTransform(k, 0, 0, k, 0, 0);
    const skip = new Set<string>();
    const it = ix.current;
    if (it.kind === 'move' || it.kind === 'scale' || it.kind === 'rotate') {
      if (!(it.kind === 'move' && it.dup)) selRef.current.forEach((id) => skip.add(id));
    }
    if (editing) skip.add(editing.id);
    drawElements(ctx, elsRef.current, skip);
  }, [k, editing]);

  const raf = useRef(0);
  const renderOverlay = useCallback(() => {
    cancelAnimationFrame(raf.current);
    raf.current = requestAnimationFrame(() => {
      const c = overlayRef.current;
      if (!c) return;
      const ctx = c.getContext('2d')!;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, c.width, c.height);
      ctx.setTransform(k, 0, 0, k, 0, 0);
      const px = 1 / scale; // 1 pixel de tela em unidades da página
      const it = ix.current;

      if (it.kind === 'stroke' || it.kind === 'shape') drawElement(ctx, it.el);

      if (it.kind === 'move' || it.kind === 'scale' || it.kind === 'rotate') {
        for (const el of selectedEls()) drawElement(ctx, { ...el, m: mul(it.d, el.m) });
      }

      if (it.kind === 'lasso' && it.pts.length > 1) {
        ctx.beginPath();
        it.pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
        ctx.closePath();
        ctx.fillStyle = 'rgba(185,167,232,0.10)';
        ctx.fill();
        ctx.setLineDash([6 * px, 5 * px]);
        ctx.strokeStyle = '#b9a7e8';
        ctx.lineWidth = 1.5 * px;
        ctx.stroke();
        ctx.setLineDash([]);
      }

      if (it.kind === 'marquee') {
        const b = rectFrom(it.start, it.cur);
        ctx.fillStyle = 'rgba(185,167,232,0.10)';
        ctx.fillRect(b.x, b.y, b.w, b.h);
        ctx.strokeStyle = '#b9a7e8';
        ctx.lineWidth = 1 * px;
        ctx.strokeRect(b.x, b.y, b.w, b.h);
      }

      // Caixa da seleção com alças
      const sel = selectedEls();
      if (sel.length && it.kind !== 'lasso' && it.kind !== 'marquee' && !editing) {
        const b = unionBox(sel.map(elBox));
        const d = it.kind === 'move' || it.kind === 'scale' || it.kind === 'rotate' ? it.d : IDENTITY;
        const corners = boxCorners(pad(b, 6 * px)).map((p) => apply(d, p));
        ctx.beginPath();
        corners.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
        ctx.closePath();
        ctx.setLineDash([5 * px, 4 * px]);
        ctx.strokeStyle = '#b9a7e8';
        ctx.lineWidth = 1.5 * px;
        ctx.stroke();
        ctx.setLineDash([]);
        if (it.kind === 'none') {
          const hs = handlePositions(b, px);
          ctx.beginPath();
          ctx.moveTo(hs.rot.x, hs.rot.y);
          ctx.lineTo(hs.rot.x, b.y - 6 * px);
          ctx.stroke();
          for (const [name, p] of Object.entries(hs)) {
            ctx.beginPath();
            if (name === 'rot') ctx.arc(p.x, p.y, (HANDLE / 2 + 1) * px, 0, Math.PI * 2);
            else ctx.rect(p.x - (HANDLE / 2) * px, p.y - (HANDLE / 2) * px, HANDLE * px, HANDLE * px);
            ctx.fillStyle = '#ffffff';
            ctx.fill();
            ctx.strokeStyle = '#8a74d6';
            ctx.lineWidth = 1.5 * px;
            ctx.stroke();
          }
        }
      }

      // Cursor da borracha
      if (tool === 'borracha' && hover.current) {
        ctx.beginPath();
        ctx.arc(hover.current.x, hover.current.y, settings.borracha.size / 2, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(244,184,207,0.9)';
        ctx.lineWidth = 1.5 * px;
        ctx.stroke();
      }
    });
  }, [k, scale, selectedEls, tool, settings.borracha.size, editing]);

  // Ajusta o tamanho dos canvas ao zoom e redesenha.
  useLayoutEffect(() => {
    for (const c of [contentRef.current, overlayRef.current]) {
      if (!c) continue;
      c.width = Math.round(W * k);
      c.height = Math.round(H * k);
    }
    renderContent();
    renderOverlay();
  }, [W, H, k, renderContent, renderOverlay]);

  useEffect(() => {
    renderContent();
    renderOverlay();
  }, [elements, selected, renderContent, renderOverlay]);

  // Fontes carregadas depois → redesenha os textos.
  useEffect(() => {
    document.fonts?.ready.then(() => renderContent());
  }, [renderContent]);

  // ---------- coordenadas ----------
  const toPage = useCallback(
    (e: { clientX: number; clientY: number }): Pt => {
      const r = wrapRef.current!.getBoundingClientRect();
      return { x: (e.clientX - r.left) / scale, y: (e.clientY - r.top) / scale };
    },
    [scale],
  );

  const handleAt = useCallback(
    (p: Pt): Handle | null => {
      const sel = selectedEls();
      if (!sel.length) return null;
      const px = 1 / scale;
      const hs = handlePositions(unionBox(sel.map(elBox)), px);
      for (const [name, h] of Object.entries(hs) as [Handle, Pt][]) {
        if (Math.abs(p.x - h.x) <= (HANDLE / 2 + 4) * px && Math.abs(p.y - h.y) <= (HANDLE / 2 + 4) * px) return name;
      }
      return null;
    },
    [scale, selectedEls],
  );

  const selectionBox = useCallback(() => {
    const sel = selectedEls();
    return sel.length ? unionBox(sel.map(elBox)) : null;
  }, [selectedEls]);

  const topHit = useCallback((p: Pt) => {
    const els = elsRef.current;
    for (let i = els.length - 1; i >= 0; i--) if (hitTest(els[i], p)) return els[i];
    return null;
  }, []);

  // ---------- texto ----------
  const startText = useCallback(
    (p: Pt) => {
      const t = settings.texto;
      const el: TextEl = {
        id: nanoid(),
        type: 'text',
        m: IDENTITY,
        opacity: 1,
        text: '',
        color: t.color,
        fontSize: t.fontSize,
        font: t.font,
        x: p.x,
        y: p.y - (t.fontSize * LINE_HEIGHT) / 2,
        w: Math.min(420, W - p.x - 24 > 120 ? W - p.x - 24 : 420),
      };
      past.current.push(elsRef.current);
      future.current = [];
      const next = [...elsRef.current, el];
      elsRef.current = next;
      setElements(next);
      setSelected(new Set());
      setEditing({ id: el.id, isNew: true });
    },
    [settings.texto, W],
  );

  const finishText = useCallback(
    (value: string) => {
      if (!editing) return;
      const cur = elsRef.current;
      const el = cur.find((e) => e.id === editing.id) as TextEl | undefined;
      setEditing(null);
      if (!el) return;
      let next: El[];
      if (!value.trim()) next = cur.filter((e) => e.id !== el.id);
      else next = cur.map((e) => (e.id === el.id ? { ...el, text: value.replace(/\s+$/, '') } : e));
      if (editing.isNew && !value.trim()) {
        // texto novo vazio: desfaz a criação sem deixar rastro no histórico
        past.current.pop();
        elsRef.current = next;
        setElements(next);
        return;
      }
      if (!editing.isNew) past.current.push(cur);
      elsRef.current = next;
      dirty.current = true;
      setElements(next);
    },
    [editing],
  );

  // ---------- ponteiro ----------
  const scroller = () => wrapRef.current?.closest('.canvas-area') as HTMLElement | null;

  const onPointerDown = (e: React.PointerEvent) => {
    e.preventDefault(); // evita seleção de texto e troca de foco
    if (editing) {
      // clique fora da caixa de texto: termina a edição
      (document.activeElement as HTMLElement | null)?.blur();
      return;
    }
    if (e.pointerType === 'pen') penSeen.current = true;
    const p = toPage(e);
    const sc = scroller();

    // Mão / espaço / botão do meio / dedo quando há caneta: rolar a folha
    const panTouch = e.pointerType === 'touch' && penSeen.current;
    if (tool === 'mao' || spaceDown.current || e.button === 1 || panTouch) {
      if (sc) ix.current = { kind: 'pan', sx: e.clientX, sy: e.clientY, left: sc.scrollLeft, top: sc.scrollTop };
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      return;
    }
    if (e.button !== 0) return;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);

    if (tool === 'caneta' || tool === 'lapis' || tool === 'marcatexto') {
      const s = settings[tool];
      const real = e.pointerType === 'pen';
      ix.current = {
        kind: 'stroke',
        el: {
          id: nanoid(),
          type: 'stroke',
          pen: tool,
          m: IDENTITY,
          color: s.color,
          size: s.size,
          opacity: s.opacity,
          real,
          points: [[p.x, p.y, real ? e.pressure || 0.5 : 0.5]],
        },
      };
      renderOverlay();
      return;
    }

    if (tool === 'forma') {
      const s = settings.forma;
      ix.current = {
        kind: 'shape',
        start: p,
        el: { id: nanoid(), type: 'shape', kind: s.kind, m: IDENTITY, color: s.color, fill: s.fill ? s.color + '40' : null, size: s.size, opacity: s.opacity, x1: p.x, y1: p.y, x2: p.x, y2: p.y },
      };
      return;
    }

    if (tool === 'borracha') {
      ix.current = { kind: 'erase', changed: false, before: elsRef.current };
      eraseAt(p);
      return;
    }

    if (tool === 'texto') {
      const hit = topHit(p);
      if (hit?.type === 'text') setEditing({ id: hit.id, isNew: false });
      else startText(p);
      return;
    }

    // laço / seleção
    const handle = handleAt(p);
    const box = selectionBox();
    if (handle && box) {
      if (handle === 'rot') ix.current = { kind: 'rotate', start: p, center: { x: box.x + box.w / 2, y: box.y + box.h / 2 }, d: IDENTITY };
      else ix.current = { kind: 'scale', start: p, anchor: oppositeCorner(box, handle), d: IDENTITY };
      renderContent();
      return;
    }
    if (box && inBox(p, box, 6 / scale)) {
      ix.current = { kind: 'move', start: p, d: IDENTITY, dup: e.altKey };
      renderContent();
      return;
    }
    if (tool === 'selecao') {
      const hit = topHit(p);
      if (hit) {
        const next = e.shiftKey ? new Set(selRef.current).add(hit.id) : new Set([hit.id]);
        selRef.current = next;
        setSelected(next);
        ix.current = { kind: 'move', start: p, d: IDENTITY, dup: e.altKey };
        renderContent();
        return;
      }
      ix.current = { kind: 'marquee', start: p, cur: p, add: e.shiftKey };
      if (!e.shiftKey) setSelected(new Set());
      return;
    }
    // laço
    setSelected(new Set());
    ix.current = { kind: 'lasso', pts: [p] };
  };

  const eraseAt = (p: Pt) => {
    const it = ix.current;
    if (it.kind !== 'erase') return;
    const r = settings.borracha.size / 2;
    const els = elsRef.current;
    let changed = false;
    const next: El[] = [];
    for (const el of els) {
      if (settings.borracha.mode === 'precisao' && el.type === 'stroke') {
        const b = elBox(el);
        if (!inBox(p, b, r)) {
          next.push(el);
          continue;
        }
        const parts = eraseFromStroke(el, p, r, nanoid);
        if (parts) {
          changed = true;
          next.push(...parts);
        } else next.push(el);
      } else if (hitTest(el, p, r)) {
        changed = true;
      } else next.push(el);
    }
    if (changed) {
      it.changed = true;
      elsRef.current = next;
      setElements(next);
    }
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const it = ix.current;
    const p = toPage(e);
    if (tool === 'borracha') {
      hover.current = p;
      if (it.kind === 'none') renderOverlay();
    }
    switch (it.kind) {
      case 'none': {
        const w = wrapRef.current;
        if (w && (tool === 'selecao' || tool === 'laco')) {
          const h = handleAt(p);
          const box = selectionBox();
          w.style.cursor = h === 'rot' ? 'grab' : h === 'nw' || h === 'se' ? 'nwse-resize' : h ? 'nesw-resize' : box && inBox(p, box, 6 / scale) ? 'move' : '';
        }
        return;
      }
      case 'pan': {
        const sc = scroller();
        if (sc) {
          sc.scrollLeft = it.left - (e.clientX - it.sx);
          sc.scrollTop = it.top - (e.clientY - it.sy);
        }
        return;
      }
      case 'stroke': {
        // eventos agrupados = traço mais fiel em movimentos rápidos
        const evs = (e.nativeEvent.getCoalescedEvents?.() ?? []) as PointerEvent[];
        const list = evs.length ? evs : [e.nativeEvent];
        const pts = it.el.points.slice();
        for (const ev of list) {
          const q = toPage(ev);
          const x = q.x;
          let y = q.y;
          // Shift: marca-texto em linha reta horizontal
          if (it.el.pen === 'marcatexto' && e.shiftKey) y = pts[0][1];
          pts.push([x, y, it.el.real ? ev.pressure || 0.5 : 0.5]);
        }
        it.el = { ...it.el, points: pts };
        renderOverlay();
        return;
      }
      case 'shape': {
        let x2 = p.x;
        let y2 = p.y;
        const { start } = it;
        if (e.shiftKey) {
          if (it.el.kind === 'linha' || it.el.kind === 'seta') {
            const ang = Math.round(Math.atan2(y2 - start.y, x2 - start.x) / (Math.PI / 4)) * (Math.PI / 4);
            const len = Math.hypot(x2 - start.x, y2 - start.y);
            x2 = start.x + len * Math.cos(ang);
            y2 = start.y + len * Math.sin(ang);
          } else {
            const s = Math.max(Math.abs(x2 - start.x), Math.abs(y2 - start.y));
            x2 = start.x + s * Math.sign(x2 - start.x || 1);
            y2 = start.y + s * Math.sign(y2 - start.y || 1);
          }
        }
        it.el = { ...it.el, x2, y2 };
        renderOverlay();
        return;
      }
      case 'erase':
        eraseAt(p);
        renderOverlay();
        return;
      case 'lasso':
        it.pts.push(p);
        renderOverlay();
        return;
      case 'marquee':
        it.cur = p;
        renderOverlay();
        return;
      case 'move':
        it.d = translate(p.x - it.start.x, p.y - it.start.y);
        renderOverlay();
        return;
      case 'scale': {
        const a = it.anchor;
        const v0 = { x: it.start.x - a.x, y: it.start.y - a.y };
        const v1 = { x: p.x - a.x, y: p.y - a.y };
        if (e.shiftKey) {
          // Shift: deforma livremente
          const sx = Math.abs(v0.x) > 1 ? v1.x / v0.x : 1;
          const sy = Math.abs(v0.y) > 1 ? v1.y / v0.y : 1;
          it.d = scaleAt(Math.max(0.05, sx), Math.max(0.05, sy), a);
        } else {
          const s = Math.max(0.05, (v1.x * v0.x + v1.y * v0.y) / (v0.x * v0.x + v0.y * v0.y || 1));
          it.d = scaleAt(s, s, a);
        }
        renderOverlay();
        return;
      }
      case 'rotate': {
        const c = it.center;
        let ang = Math.atan2(p.y - c.y, p.x - c.x) - Math.atan2(it.start.y - c.y, it.start.x - c.x);
        if (e.shiftKey) ang = Math.round(ang / (Math.PI / 12)) * (Math.PI / 12);
        it.d = rotateAt(ang, c);
        renderOverlay();
        return;
      }
    }
  };

  const onPointerUp = () => {
    const it = ix.current;
    ix.current = { kind: 'none' };
    switch (it.kind) {
      case 'stroke':
        commit([...elsRef.current, it.el]);
        break;
      case 'shape': {
        const el = it.el;
        if (Math.hypot(el.x2 - el.x1, el.y2 - el.y1) > 3) commit([...elsRef.current, el]);
        break;
      }
      case 'erase':
        if (it.changed) {
          past.current.push(it.before);
          future.current = [];
          dirty.current = true;
          setElements([...elsRef.current]);
        }
        break;
      case 'lasso': {
        const poly = it.pts;
        if (poly.length > 2) {
          const ids = elsRef.current
            .filter((el) => {
              const pts = samplePoints(el);
              const inside = pts.filter((q) => pointInPolygon(q, poly)).length;
              return inside / pts.length >= 0.5;
            })
            .map((el) => el.id);
          setSelected(new Set(ids));
        }
        break;
      }
      case 'marquee': {
        const b = rectFrom(it.start, it.cur);
        if (b.w > 2 || b.h > 2) {
          const ids = elsRef.current.filter((el) => boxesIntersect(elBox(el), b)).map((el) => el.id);
          setSelected(it.add ? new Set([...selRef.current, ...ids]) : new Set(ids));
        }
        break;
      }
      case 'move':
      case 'scale':
      case 'rotate': {
        const moved = it.d.some((v, i) => Math.abs(v - IDENTITY[i]) > 1e-6);
        if (moved) {
          const sel = selRef.current;
          if (it.kind === 'move' && it.dup) {
            const copies = elsRef.current.filter((el) => sel.has(el.id)).map((el) => ({ ...el, id: nanoid(), m: mul(it.d, el.m) }));
            commit([...elsRef.current, ...copies]);
            setSelected(new Set(copies.map((c) => c.id)));
          } else {
            commit(elsRef.current.map((el) => (sel.has(el.id) ? { ...el, m: mul(it.d, el.m) } : el)));
          }
        } else {
          renderContent();
          renderOverlay();
        }
        break;
      }
    }
    renderOverlay();
  };

  const onPointerLeave = () => {
    hover.current = null;
    if (tool === 'borracha') renderOverlay();
  };

  const onDoubleClick = (e: React.MouseEvent) => {
    if (tool !== 'selecao' && tool !== 'laco') return;
    const hit = topHit(toPage(e));
    if (hit?.type === 'text') {
      setSelected(new Set());
      setEditing({ id: hit.id, isNew: false });
    }
  };

  // ---------- ações ----------
  const api: EditorApi = {
    undo,
    redo,
    copy() {
      clipboard = structuredClone(selectedEls());
      pasteCount = 0;
      onStatus({ canUndo: past.current.length > 0, canRedo: future.current.length > 0, selected: selRef.current.size, canPaste: clipboard.length > 0 });
    },
    cut() {
      api.copy();
      api.remove();
    },
    paste() {
      if (!clipboard.length) return;
      pasteCount++;
      const off = 24 * pasteCount;
      const copies = clipboard.map((el) => ({ ...structuredClone(el), id: nanoid(), m: mul(translate(off, off), el.m) }));
      commit([...elsRef.current, ...copies]);
      setSelected(new Set(copies.map((c) => c.id)));
      if (tool !== 'selecao' && tool !== 'laco') onToolChange('selecao');
    },
    duplicate() {
      const sel = selectedEls();
      if (!sel.length) return;
      const copies = sel.map((el) => ({ ...el, id: nanoid(), m: mul(translate(24, 24), el.m) }));
      commit([...elsRef.current, ...copies]);
      setSelected(new Set(copies.map((c) => c.id)));
    },
    remove() {
      if (!selRef.current.size) return;
      commit(elsRef.current.filter((el) => !selRef.current.has(el.id)));
      setSelected(new Set());
    },
    selectAll() {
      if (tool !== 'selecao' && tool !== 'laco') onToolChange('selecao');
      setSelected(new Set(elsRef.current.map((e) => e.id)));
    },
    clearSelection() {
      setSelected(new Set());
    },
    bringToFront() {
      const sel = selRef.current;
      commit([...elsRef.current.filter((e) => !sel.has(e.id)), ...elsRef.current.filter((e) => sel.has(e.id))]);
    },
    sendToBack() {
      const sel = selRef.current;
      commit([...elsRef.current.filter((e) => sel.has(e.id)), ...elsRef.current.filter((e) => !sel.has(e.id))]);
    },
    applyStyle(style) {
      const sel = selRef.current;
      if (!sel.size) return;
      commit(
        elsRef.current.map((el) => {
          if (!sel.has(el.id)) return el;
          const n = { ...el } as El;
          if (style.color !== undefined) {
            n.color = style.color;
            if (n.type === 'shape' && n.fill) n.fill = style.color + '40';
          }
          if (style.opacity !== undefined) n.opacity = style.opacity;
          if (style.size !== undefined && n.type !== 'text') {
            n.size = style.size;
            if (n.type === 'stroke') n.points = n.points.slice();
          }
          return n;
        }),
      );
    },
  };
  const apiRef = useRef(api);
  apiRef.current = api;
  useImperativeHandle(ref, () => ({
    undo: () => apiRef.current.undo(),
    redo: () => apiRef.current.redo(),
    copy: () => apiRef.current.copy(),
    cut: () => apiRef.current.cut(),
    paste: () => apiRef.current.paste(),
    duplicate: () => apiRef.current.duplicate(),
    remove: () => apiRef.current.remove(),
    selectAll: () => apiRef.current.selectAll(),
    clearSelection: () => apiRef.current.clearSelection(),
    bringToFront: () => apiRef.current.bringToFront(),
    sendToBack: () => apiRef.current.sendToBack(),
    applyStyle: (s) => apiRef.current.applyStyle(s),
  }));

  // ---------- teclado ----------
  useEffect(() => {
    const isField = (t: EventTarget | null) => {
      const el = t as HTMLElement | null;
      return !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable);
    };
    const down = (e: KeyboardEvent) => {
      if (isField(e.target)) return;
      const mod = e.ctrlKey || e.metaKey;
      const a = apiRef.current;
      const key = e.key.toLowerCase();
      if (e.key === ' ' && !spaceDown.current) {
        spaceDown.current = true;
        if (wrapRef.current) wrapRef.current.style.cursor = 'grab';
        e.preventDefault();
        return;
      }
      if (mod && key === 'z' && !e.shiftKey) a.undo();
      else if (mod && (key === 'y' || (key === 'z' && e.shiftKey))) a.redo();
      else if (mod && key === 'c') a.copy();
      else if (mod && key === 'x') a.cut();
      else if (mod && key === 'v') a.paste();
      else if (mod && key === 'd') a.duplicate();
      else if (mod && key === 'a') a.selectAll();
      else if (e.key === 'Delete' || e.key === 'Backspace') a.remove();
      else if (e.key === 'Escape') a.clearSelection();
      else if (!mod && !e.altKey) {
        const map: Record<string, Tool> = { v: 'selecao', l: 'laco', p: 'caneta', b: 'lapis', h: 'marcatexto', e: 'borracha', t: 'texto', s: 'forma' };
        if (map[key]) onToolChange(map[key]);
        else return;
      } else return;
      e.preventDefault();
    };
    const up = (e: KeyboardEvent) => {
      if (e.key === ' ') {
        spaceDown.current = false;
        if (wrapRef.current) wrapRef.current.style.cursor = '';
      }
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
  }, [onToolChange]);

  // ---------- caixa de texto em edição ----------
  const editingEl = editing ? (elements.find((e) => e.id === editing.id) as TextEl | undefined) : undefined;

  const cursor = tool === 'mao' ? 'grab' : tool === 'texto' ? 'text' : tool === 'selecao' || tool === 'laco' ? 'default' : tool === 'borracha' ? 'none' : 'crosshair';

  return (
    <div
      ref={wrapRef}
      className="editor"
      style={{ width: W * scale, height: H * scale, cursor, touchAction: 'none' }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onPointerLeave={onPointerLeave}
      onDoubleClick={onDoubleClick}
      onContextMenu={(e) => e.preventDefault()}
    >
      <canvas ref={contentRef} style={{ width: W * scale, height: H * scale }} />
      <canvas ref={overlayRef} style={{ width: W * scale, height: H * scale }} />
      {editingEl && <TextEditor el={editingEl} scale={scale} ink={ink} onDone={finishText} />}
    </div>
  );
});

function TextEditor({ el, scale, onDone }: { el: TextEl; scale: number; ink: string; onDone: (v: string) => void }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const [value, setValue] = useState(el.text);
  const s = matScale(el.m);
  const pos = apply(el.m, { x: el.x, y: el.y });
  useEffect(() => {
    const t = ref.current;
    if (!t) return;
    t.focus();
    t.setSelectionRange(t.value.length, t.value.length);
  }, []);
  useLayoutEffect(() => {
    const t = ref.current;
    if (!t) return;
    t.style.height = '0px';
    t.style.height = t.scrollHeight + 'px';
  }, [value, scale]);
  return (
    <textarea
      ref={ref}
      className="text-editor"
      value={value}
      placeholder="Digite…"
      onChange={(e) => setValue(e.target.value)}
      onBlur={() => onDone(value)}
      onPointerDown={(e) => e.stopPropagation()}
      onKeyDown={(e) => {
        if (e.key === 'Escape' || (e.key === 'Enter' && (e.ctrlKey || e.metaKey))) {
          e.preventDefault();
          ref.current?.blur();
        }
        e.stopPropagation();
      }}
      style={{
        left: pos.x * scale,
        top: pos.y * scale,
        width: el.w * s * scale,
        color: el.color,
        opacity: el.opacity,
        fontFamily: FONT_FAMILY[el.font],
        fontWeight: el.font === 'mao' ? 600 : 400,
        fontSize: el.fontSize * s * scale,
        lineHeight: LINE_HEIGHT,
      }}
    />
  );
}

// ---------- utilidades ----------

function rectFrom(a: Pt, b: Pt): Box {
  return { x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), w: Math.abs(b.x - a.x), h: Math.abs(b.y - a.y) };
}

function pad(b: Box, p: number): Box {
  return { x: b.x - p, y: b.y - p, w: b.w + 2 * p, h: b.h + 2 * p };
}

function handlePositions(b: Box, px: number): Record<Handle, Pt> {
  const q = pad(b, 6 * px);
  return {
    nw: { x: q.x, y: q.y },
    ne: { x: q.x + q.w, y: q.y },
    se: { x: q.x + q.w, y: q.y + q.h },
    sw: { x: q.x, y: q.y + q.h },
    rot: { x: q.x + q.w / 2, y: q.y - ROT_OFFSET * px },
  };
}

function oppositeCorner(b: Box, h: Handle): Pt {
  switch (h) {
    case 'nw':
      return { x: b.x + b.w, y: b.y + b.h };
    case 'ne':
      return { x: b.x, y: b.y + b.h };
    case 'se':
      return { x: b.x, y: b.y };
    default:
      return { x: b.x + b.w, y: b.y };
  }
}

/** Miniatura do conteúdo (fundo transparente; o papel é desenhado por baixo na hora de exibir). */
export function renderThumbnail(page: Page, els: El[]): string | undefined {
  try {
    if (!els.length) return '';
    const w = 220;
    const s = w / page.width;
    const c = document.createElement('canvas');
    c.width = w;
    c.height = Math.round(page.height * s);
    const ctx = c.getContext('2d')!;
    ctx.scale(s, s);
    drawElements(ctx, els);
    return c.toDataURL('image/png');
  } catch {
    return undefined;
  }
}

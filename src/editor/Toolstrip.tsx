import { useRef, useState } from 'react';
import { Icon } from '../icons';
import { useOutside } from '../components/useOutside';
import { InsertMenu } from './InsertMenu';
import type { FontKind, ShapeKind } from './elements';
import type { EditorApi, EditorStatus } from './Editor';
import type { PenSettings, Tool, ToolSettings } from './tools';
import { HIGHLIGHT_COLORS, INK_COLORS, SHAPE_LABEL, SIZE_PRESETS, TOOL_LABEL } from './tools';

interface Props {
  tool: Tool;
  setTool: (t: Tool) => void;
  settings: ToolSettings;
  setSettings: React.Dispatch<React.SetStateAction<ToolSettings>>;
  status: EditorStatus;
  api: React.RefObject<EditorApi | null>;
  onImportPdf: (files: File[]) => void;
}

const SHAPE_ICONS: Record<ShapeKind, string> = {
  linha: 'M5 19L19 5',
  seta: 'M5 19L19 5M19 5h-7M19 5v7',
  retangulo: 'M4 6h16v12H4z',
  elipse: 'M12 19c4.4 0 8-3.1 8-7s-3.6-7-8-7-8 3.1-8 7 3.6 7 8 7z',
  triangulo: 'M12 4l9 16H3z',
  losango: 'M12 3l9 9-9 9-9-9z',
  hexagono: 'M12 3l7.8 4.5v9L12 21l-7.8-4.5v-9z',
};

function PathIcon({ d }: { d: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" width={19} height={19} aria-hidden>
      <path d={d} />
    </svg>
  );
}

const PENCIL = 'M17 3l4 4L8 20H4v-4zM14 6l4 4';

export function Toolstrip({ tool, setTool, settings, setSettings, status, api, onImportPdf }: Props) {
  const hasSel = status.selected > 0;

  const toolBtn = (t: Tool, icon: React.ReactNode) => (
    <button key={t} className={`icon-btn ${tool === t ? 'active' : ''}`} onClick={() => setTool(t)} title={TOOL_LABEL[t]} aria-pressed={tool === t}>
      {icon}
    </button>
  );

  // Qual conjunto de ajustes mostrar: o da ferramenta, ou o da caneta quando há seleção.
  const penKey = tool === 'caneta' || tool === 'lapis' || tool === 'marcatexto' ? tool : null;

  const setPen = (key: 'caneta' | 'lapis' | 'marcatexto', patch: Partial<PenSettings>) => setSettings((s) => ({ ...s, [key]: { ...s[key], ...patch } }));

  return (
    <div className="toolstrip" role="toolbar" aria-label="Ferramentas">
      <div className="group">
        {toolBtn('selecao', <PathIcon d="M5 3l14 8-6 2-2 6z" />)}
        {toolBtn('laco', <Icon name="lasso" />)}
        {toolBtn('mao', <PathIcon d="M18 11V6a2 2 0 0 0-4 0M14 10V4a2 2 0 0 0-4 0v2M10 10.5V6a2 2 0 0 0-4 0v8M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.9-6-2.4l-3.6-3.6a2 2 0 0 1 2.8-2.8L7 15" />)}
      </div>
      <span className="sep" />
      <div className="group">
        {toolBtn('caneta', <Icon name="pen" />)}
        {toolBtn('lapis', <PathIcon d={PENCIL} />)}
        {toolBtn('marcatexto', <Icon name="highlighter" />)}
        {toolBtn('borracha', <Icon name="eraser" />)}
        {toolBtn('texto', <Icon name="text" />)}
        {toolBtn('forma', <PathIcon d={SHAPE_ICONS[settings.forma.kind]} />)}
      </div>
      <span className="sep" />
      <InsertMenu api={api} onImportPdf={onImportPdf} />
      <span className="sep" />

      <div className="group options">
        {penKey && (
          <StyleControls
            colors={penKey === 'marcatexto' ? HIGHLIGHT_COLORS : INK_COLORS}
            color={settings[penKey].color}
            size={settings[penKey].size}
            sizes={SIZE_PRESETS[penKey]}
            opacity={settings[penKey].opacity}
            onChange={(p) => setPen(penKey, p)}
          />
        )}

        {tool === 'forma' && (
          <>
            <ShapePicker value={settings.forma.kind} onChange={(kind) => setSettings((s) => ({ ...s, forma: { ...s.forma, kind } }))} />
            <button
              className={`icon-btn ${settings.forma.fill ? 'active' : ''}`}
              title="Preenchimento"
              onClick={() => setSettings((s) => ({ ...s, forma: { ...s.forma, fill: !s.forma.fill } }))}
            >
              <svg viewBox="0 0 24 24" width={19} height={19} aria-hidden>
                <rect x="4" y="4" width="16" height="16" rx="3" fill={settings.forma.fill ? 'currentColor' : 'none'} fillOpacity={0.35} stroke="currentColor" strokeWidth="1.8" />
              </svg>
            </button>
            <StyleControls
              colors={INK_COLORS}
              color={settings.forma.color}
              size={settings.forma.size}
              sizes={SIZE_PRESETS.forma}
              opacity={settings.forma.opacity}
              onChange={(p) => setSettings((s) => ({ ...s, forma: { ...s.forma, ...p } }))}
            />
          </>
        )}

        {tool === 'borracha' && (
          <>
            <div className="seg">
              <button className={settings.borracha.mode === 'traco' ? 'on' : ''} onClick={() => setSettings((s) => ({ ...s, borracha: { ...s.borracha, mode: 'traco' } }))}>
                Traço inteiro
              </button>
              <button className={settings.borracha.mode === 'precisao' ? 'on' : ''} onClick={() => setSettings((s) => ({ ...s, borracha: { ...s.borracha, mode: 'precisao' } }))}>
                Precisão
              </button>
            </div>
            <SizeDots sizes={SIZE_PRESETS.borracha} value={settings.borracha.size} color="#f4b8cf" max={44} onChange={(size) => setSettings((s) => ({ ...s, borracha: { ...s.borracha, size } }))} />
          </>
        )}

        {tool === 'texto' && (
          <>
            <select
              className="mini-select"
              value={settings.texto.font}
              onChange={(e) => setSettings((s) => ({ ...s, texto: { ...s.texto, font: e.target.value as FontKind } }))}
              aria-label="Fonte"
            >
              <option value="sans">Moderna</option>
              <option value="mao">Manuscrita</option>
              <option value="serif">Clássica</option>
            </select>
            <select
              className="mini-select"
              value={settings.texto.fontSize}
              onChange={(e) => setSettings((s) => ({ ...s, texto: { ...s.texto, fontSize: Number(e.target.value) } }))}
              aria-label="Tamanho do texto"
            >
              {[14, 16, 18, 22, 28, 36, 48, 64].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
            <Swatches colors={INK_COLORS} value={settings.texto.color} onChange={(color) => setSettings((s) => ({ ...s, texto: { ...s.texto, color } }))} />
          </>
        )}

        {status.cropping && (
          <>
            <span className="hint">Arraste os cantos rosa para recortar</span>
            <button className="btn primary" onClick={() => api.current?.endCrop()}>
              Concluir recorte
            </button>
          </>
        )}
        {!status.cropping && (tool === 'selecao' || tool === 'laco') && hasSel && (
          <>
            <span className="hint">{status.selected} selecionado(s)</span>
            {status.single === 'image' && (
              <button className="btn ghost" onClick={() => api.current?.startCrop()} title="Recortar imagem (ou duplo clique nela)">
                <PathIcon d="M6 2v14a2 2 0 0 0 2 2h14M18 22V8a2 2 0 0 0-2-2H2" /> Recortar
              </button>
            )}
            {status.single === 'link' && (
              <button className="btn ghost" onClick={() => api.current?.openSelected()} title="Abrir link ou documento">
                <PathIcon d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14L21 3" /> Abrir
              </button>
            )}
            <Swatches colors={INK_COLORS} value="" onChange={(color) => api.current?.applyStyle({ color })} />
            <OpacitySlider value={1} onCommit={(opacity) => api.current?.applyStyle({ opacity })} />
          </>
        )}
        {!status.cropping && (tool === 'selecao' || tool === 'laco') && !hasSel && (
          <span className="hint">{tool === 'laco' ? 'Contorne o que quer selecionar' : 'Clique num elemento ou arraste para selecionar'}</span>
        )}
        {tool === 'mao' && <span className="hint">Arraste para mover a folha. Dica: segure espaço com qualquer ferramenta.</span>}
      </div>

      <span className="spacer" />

      <div className="group">
        {hasSel && (
          <>
            <button className="icon-btn" onClick={() => api.current?.copy()} title="Copiar (Ctrl C)">
              <Icon name="copy" />
            </button>
            <button className="icon-btn" onClick={() => api.current?.duplicate()} title="Duplicar (Ctrl D)">
              <PathIcon d="M8 8h12v12H8zM4 16V4h12M14 11v6M11 14h6" />
            </button>
            <button className="icon-btn" onClick={() => api.current?.bringToFront()} title="Trazer para a frente">
              <PathIcon d="M12 4v10M8 8l4-4 4 4M5 20h14" />
            </button>
            <button className="icon-btn" onClick={() => api.current?.sendToBack()} title="Enviar para trás">
              <PathIcon d="M12 20V10M8 16l4 4 4-4M5 4h14" />
            </button>
            <button className="icon-btn" onClick={() => api.current?.remove()} title="Excluir (Delete)">
              <Icon name="trash" />
            </button>
          </>
        )}
        <button className="icon-btn" disabled={!status.canPaste} onClick={() => api.current?.paste()} title="Colar (Ctrl V)">
          <PathIcon d="M9 4h6v3H9zM16 5h2a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h2" />
        </button>
        <span className="sep" />
        <button className="icon-btn" disabled={!status.canUndo} onClick={() => api.current?.undo()} title="Desfazer (Ctrl Z)">
          <Icon name="undo" />
        </button>
        <button className="icon-btn" disabled={!status.canRedo} onClick={() => api.current?.redo()} title="Refazer (Ctrl Y)">
          <Icon name="redo" />
        </button>
      </div>
    </div>
  );
}

function StyleControls({
  colors,
  color,
  size,
  sizes,
  opacity,
  onChange,
}: {
  colors: string[];
  color: string;
  size: number;
  sizes: number[];
  opacity: number;
  onChange: (p: Partial<PenSettings>) => void;
}) {
  return (
    <>
      <Swatches colors={colors} value={color} onChange={(c) => onChange({ color: c })} />
      <span className="sep" />
      <SizeDots sizes={sizes} value={size} color={color} max={sizes[sizes.length - 1]} onChange={(s) => onChange({ size: s })} />
      <SizeSlider value={size} max={sizes[sizes.length - 1] * 1.6} onChange={(s) => onChange({ size: s })} />
      <span className="sep" />
      <OpacitySlider value={opacity} onCommit={(o) => onChange({ opacity: o })} live />
    </>
  );
}

function Swatches({ colors, value, onChange }: { colors: string[]; value: string; onChange: (c: string) => void }) {
  return (
    <div className="swatches tight">
      {colors.map((c) => (
        <button key={c} className={`swatch sm ${value.toLowerCase() === c ? 'on' : ''}`} style={{ background: c }} onClick={() => onChange(c)} aria-label={`Cor ${c}`} />
      ))}
      <label className="swatch sm swatch-custom" title="Outra cor">
        <input type="color" value={value || '#ffffff'} onChange={(e) => onChange(e.target.value)} />
      </label>
    </div>
  );
}

function SizeDots({ sizes, value, color, max, onChange }: { sizes: number[]; value: number; color: string; max: number; onChange: (s: number) => void }) {
  return (
    <div className="size-dots">
      {sizes.map((s) => (
        <button key={s} className={Math.abs(value - s) < 0.01 ? 'on' : ''} onClick={() => onChange(s)} title={`Espessura ${s}`}>
          <span style={{ width: 4 + (s / max) * 14, height: 4 + (s / max) * 14, background: color }} />
        </button>
      ))}
    </div>
  );
}

function SizeSlider({ value, max, onChange }: { value: number; max: number; onChange: (s: number) => void }) {
  return (
    <label className="slider hide-sm" title="Espessura">
      <input type="range" min={1} max={Math.round(max)} step={0.5} value={value} onChange={(e) => onChange(Number(e.target.value))} />
      <span>{value}</span>
    </label>
  );
}

function OpacitySlider({ value, onCommit, live }: { value: number; onCommit: (o: number) => void; live?: boolean }) {
  const [v, setV] = useState(value);
  const shown = live ? value : v;
  return (
    <label className="slider" title="Opacidade">
      <svg viewBox="0 0 24 24" width={16} height={16} aria-hidden>
        <circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" strokeWidth="1.8" />
        <path d="M12 4a8 8 0 0 1 0 16z" fill="currentColor" />
      </svg>
      <input
        type="range"
        min={0.1}
        max={1}
        step={0.05}
        value={shown}
        onChange={(e) => (live ? onCommit(Number(e.target.value)) : setV(Number(e.target.value)))}
        onPointerUp={() => !live && onCommit(v)}
        onKeyUp={() => !live && onCommit(v)}
      />
      <span>{Math.round(shown * 100)}%</span>
    </label>
  );
}

function ShapePicker({ value, onChange }: { value: ShapeKind; onChange: (k: ShapeKind) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useOutside(ref, open, () => setOpen(false));
  return (
    <div className="row-menu" ref={ref}>
      <button className="btn ghost" onClick={() => setOpen((o) => !o)} title="Tipo de forma">
        <PathIcon d={SHAPE_ICONS[value]} /> <span className="hide-sm">{SHAPE_LABEL[value]}</span> <Icon name="down" width={14} />
      </button>
      {open && (
        <div className="menu" style={{ left: 0, right: 'auto' }}>
          {(Object.keys(SHAPE_LABEL) as ShapeKind[]).map((k) => (
            <button
              key={k}
              onClick={() => {
                onChange(k);
                setOpen(false);
              }}
            >
              <PathIcon d={SHAPE_ICONS[k]} /> {SHAPE_LABEL[k]}
            </button>
          ))}
          <hr />
          <span className="hint" style={{ padding: '4px 10px' }}>
            Segure Shift para linhas retas e formas proporcionais
          </span>
        </div>
      )}
    </div>
  );
}

import { useRef } from 'react';
import { db, NOTEBOOK_ID, updateNotebook, updatePage } from '../db';
import type { Page, PageTemplate, PaperColor, PaperPattern } from '../types';
import { PAGE_SIZES, PAPER_COLORS, PATTERN_LABEL } from '../types';
import { PaperCanvas } from './PaperCanvas';
import { useOutside } from './useOutside';

export function TemplatePopover({ page, onClose, right }: { page: Page; onClose: () => void; right: number }) {
  const ref = useRef<HTMLDivElement>(null);
  useOutside(ref, true, onClose);
  const t = page.template;
  const set = (patch: Partial<PageTemplate>) => updatePage(page.id, { template: { ...t, ...patch } });
  const sizeKey = (Object.keys(PAGE_SIZES) as Array<keyof typeof PAGE_SIZES>).find((k) => PAGE_SIZES[k].w === page.width && PAGE_SIZES[k].h === page.height) ?? 'a4';

  const applyToSection = async () => {
    const pages = await db.pages.where('sectionId').equals(page.sectionId).toArray();
    await Promise.all(pages.map((p) => updatePage(p.id, { template: { ...t }, width: page.width, height: page.height })));
  };

  return (
    <div className="popover" ref={ref} style={{ right }}>
      <h4>Cor do papel</h4>
      <div className="swatches" style={{ marginBottom: 14 }}>
        {(Object.keys(PAPER_COLORS) as Array<Exclude<PaperColor, 'custom'>>).map((c) => (
          <button
            key={c}
            className={`swatch ${t.color === c ? 'on' : ''}`}
            style={{ background: PAPER_COLORS[c].bg }}
            title={PAPER_COLORS[c].label}
            onClick={() => set({ color: c })}
          />
        ))}
        <label className={`swatch swatch-custom ${t.color === 'custom' ? 'on' : ''}`} title="Cor personalizada">
          <input type="color" value={t.customColor ?? '#2b2540'} onChange={(e) => set({ color: 'custom', customColor: e.target.value })} />
        </label>
      </div>

      <h4>Modelo</h4>
      <div className="grid">
        {(Object.keys(PATTERN_LABEL) as PaperPattern[]).map((p) => (
          <button key={p} className={`tpl ${t.pattern === p ? 'on' : ''}`} onClick={() => set({ pattern: p })}>
            <PaperCanvas template={{ ...t, pattern: p }} width={208} height={264} scale={0.25} />
            {PATTERN_LABEL[p]}
          </button>
        ))}
      </div>

      <label className="row">
        <span>Tamanho</span>
        <select
          value={sizeKey}
          onChange={(e) => {
            const s = PAGE_SIZES[e.target.value as keyof typeof PAGE_SIZES];
            updatePage(page.id, { width: s.w, height: s.h });
          }}
        >
          {Object.entries(PAGE_SIZES).map(([k, s]) => (
            <option key={k} value={k}>
              {s.label}
            </option>
          ))}
        </select>
      </label>

      <button className="btn apply-all" onClick={applyToSection}>
        Aplicar a todas as páginas da aula
      </button>
      <button className="btn ghost apply-all" onClick={() => updateNotebook({ defaultTemplate: { ...t } })} title={`Caderno ${NOTEBOOK_ID}`}>
        Usar como padrão para aulas novas
      </button>
    </div>
  );
}

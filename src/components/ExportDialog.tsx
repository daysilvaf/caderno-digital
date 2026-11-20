import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { db, NOTEBOOK_ID, sectionPages } from '../db';
import { allPagesInOrder, exportPdf, exportPngs, printPages, safeName } from '../export';
import { Icon } from '../icons';
import type { Page, Section } from '../types';

type Scope = 'pagina' | 'selecionar' | 'aula' | 'caderno';
type Format = 'pdf' | 'png';

export function ExportDialog({ section, current, onClose }: { section: Section; current: Page; onClose: () => void }) {
  const [scope, setScope] = useState<Scope>('pagina');
  const [format, setFormat] = useState<Format>('pdf');
  const [picked, setPicked] = useState<Set<string>>(new Set([current.id]));
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const pages = useLiveQuery(() => sectionPages(section.id), [section.id]);
  const nb = useLiveQuery(() => db.notebooks.get(NOTEBOOK_ID));

  const collect = async (): Promise<{ pages: Page[]; name: string }> => {
    const base = safeName(`${section.number} ${section.title}`);
    if (scope === 'pagina') return { pages: [current], name: `${base}-p${current.order + 1}` };
    if (scope === 'selecionar') return { pages: (pages ?? []).filter((p) => picked.has(p.id)), name: `${base}-selecao` };
    if (scope === 'aula') return { pages: pages ?? [], name: base };
    const all = await allPagesInOrder();
    return { pages: all.flatMap((x) => x.pages), name: safeName(nb?.title ?? 'caderno') };
  };

  const run = async (kind: 'export' | 'print') => {
    setError(null);
    try {
      const { pages: list, name } = await collect();
      if (!list.length) return setError('Escolha pelo menos uma página.');
      const prog = (d: number, t: number) => setBusy(`Preparando página ${d} de ${t}…`);
      setBusy('Preparando…');
      if (kind === 'print') await printPages(list, prog);
      else if (format === 'pdf') await exportPdf(list, name, prog);
      else await exportPngs(list, name, prog);
      setBusy(null);
      onClose();
    } catch (e) {
      console.error(e);
      setBusy(null);
      setError('Não foi possível exportar. Tente com menos páginas de cada vez.');
    }
  };

  return (
    <div className="modal-backdrop" onPointerDown={(e) => e.target === e.currentTarget && !busy && onClose()}>
      <div className="modal" role="dialog" aria-label="Exportar">
        <div className="modal-head">
          <h3>Exportar e imprimir</h3>
          <button className="icon-btn" onClick={onClose} disabled={!!busy} aria-label="Fechar">
            <Icon name="x" />
          </button>
        </div>

        <h4>O que exportar</h4>
        <div className="radio-list">
          {(
            [
              ['pagina', 'Esta página'],
              ['selecionar', 'Escolher páginas desta aula'],
              ['aula', `Aula inteira (${pages?.length ?? 0} págs.)`],
              ['caderno', 'Caderno completo'],
            ] as Array<[Scope, string]>
          ).map(([v, label]) => (
            <label key={v} className={scope === v ? 'on' : ''}>
              <input type="radio" name="scope" value={v} checked={scope === v} onChange={() => setScope(v)} />
              {label}
            </label>
          ))}
        </div>

        {scope === 'selecionar' && (
          <div className="pick-grid">
            {pages?.map((p, i) => (
              <label key={p.id} className={picked.has(p.id) ? 'on' : ''}>
                <input
                  type="checkbox"
                  checked={picked.has(p.id)}
                  onChange={() =>
                    setPicked((s) => {
                      const n = new Set(s);
                      if (n.has(p.id)) n.delete(p.id);
                      else n.add(p.id);
                      return n;
                    })
                  }
                />
                {p.title || `Página ${i + 1}`}
              </label>
            ))}
          </div>
        )}

        <h4>Formato</h4>
        <div className="seg" style={{ display: 'inline-flex' }}>
          <button className={format === 'pdf' ? 'on' : ''} onClick={() => setFormat('pdf')}>
            PDF
          </button>
          <button className={format === 'png' ? 'on' : ''} onClick={() => setFormat('png')}>
            Imagens PNG
          </button>
        </div>
        <p className="hint" style={{ whiteSpace: 'normal' }}>
          {format === 'png' ? 'Uma página vira um .png; várias páginas vêm juntas num .zip.' : 'O PDF mantém o fundo, a escrita, os PDFs importados e as imagens.'}
        </p>

        {error && <p style={{ color: 'var(--danger)' }}>{error}</p>}
        {busy && <p className="hint">{busy}</p>}

        <div className="modal-actions">
          <button className="btn" onClick={() => run('print')} disabled={!!busy}>
            Imprimir
          </button>
          <button className="btn primary" onClick={() => run('export')} disabled={!!busy}>
            Exportar {format === 'pdf' ? 'PDF' : 'PNG'}
          </button>
        </div>
      </div>
    </div>
  );
}

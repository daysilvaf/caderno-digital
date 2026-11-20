import Dexie from 'dexie';
import { useLiveQuery } from 'dexie-react-hooks';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { addPage, db, deletePage, duplicatePage, NOTEBOOK_ID, reorderPage, updatePage } from '../db';
import { Icon } from '../icons';
import { go } from '../router';
import { useSaving } from '../saveStatus';
import type { Page } from '../types';
import { numberColor } from './IndexView';
import { PaperCanvas } from './PaperCanvas';
import { TemplatePopover } from './TemplatePopover';
import { TagsPopover } from './TagsPopover';
import { importPdf } from '../pdf';
import { useOutside } from './useOutside';
import type { EditorApi, EditorStatus } from '../editor/Editor';
import { Editor } from '../editor/Editor';
import { Toolstrip } from '../editor/Toolstrip';
import { useToolState } from '../editor/tools';

const ZOOMS = [0.25, 0.33, 0.5, 0.67, 0.75, 0.9, 1, 1.1, 1.25, 1.5, 1.75, 2, 2.5, 3, 4];

function loadPref<T>(key: string, fallback: T): T {
  try {
    const v = localStorage.getItem(key);
    return v ? (JSON.parse(v) as T) : fallback;
  } catch {
    return fallback;
  }
}
function savePref(key: string, v: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(v));
  } catch {
    /* sem armazenamento */
  }
}

export function NotebookView({ sectionId, pageId }: { sectionId: string; pageId?: string }) {
  const section = useLiveQuery(() => db.sections.get(sectionId).then((s) => s ?? null), [sectionId]);
  const pages = useLiveQuery(
    () => db.pages.where('[sectionId+order]').between([sectionId, Dexie.minKey], [sectionId, Dexie.maxKey]).toArray(),
    [sectionId],
  );
  const sections = useLiveQuery(() => db.sections.where('notebookId').equals(NOTEBOOK_ID).sortBy('order'));

  const [sidebar, setSidebar] = useState(() => loadPref('sidebar', window.innerWidth > 760));
  const [sideTab, setSideTab] = useState<'paginas' | 'aulas'>('paginas');
  const [zoom, setZoom] = useState<number | 'fit'>(() => loadPref('zoom', 'fit'));
  const [tplOpen, setTplOpen] = useState(false);
  const [tagsOpen, setTagsOpen] = useState(false);
  const [pdfProgress, setPdfProgress] = useState<{ name: string; done: number; total: number } | null>(null);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const saving = useSaving();
  const { tool, setTool, settings, setSettings } = useToolState();
  const editorApi = useRef<EditorApi>(null);
  const [status, setStatus] = useState<EditorStatus>({ canUndo: false, canRedo: false, selected: 0, canPaste: false, single: null, cropping: false });
  const onStatus = useCallback((s: EditorStatus) => setStatus(s), []);
  const areaRef = useRef<HTMLDivElement>(null);
  const [areaW, setAreaW] = useState(800);

  useEffect(() => savePref('sidebar', sidebar), [sidebar]);
  useEffect(() => savePref('zoom', zoom), [zoom]);

  // Página atual: a da URL, ou a primeira da aula.
  const current = pages?.find((p) => p.id === pageId) ?? pages?.[0];
  const idx = current && pages ? pages.indexOf(current) : -1;
  useEffect(() => {
    if (!pages || !current || current.id === pageId) return;
    // A lista pode ainda não ter a página recém-criada: só corrige a URL se ela não existir mesmo.
    let alive = true;
    (pageId ? db.pages.get(pageId) : Promise.resolve(undefined)).then((p) => {
      if (alive && (!p || p.sectionId !== sectionId)) go({ name: 'pagina', sectionId, pageId: current.id }, true);
    });
    return () => {
      alive = false;
    };
  }, [pages, current, pageId, sectionId]);

  // Se a aula não existe mais, volta ao índice.
  useEffect(() => {
    if (section === undefined) return;
    if (section === null) go({ name: 'indice' }, true);
  }, [section]);

  useLayoutEffect(() => {
    const el = areaRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setAreaW(el.clientWidth));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const fitScale = current ? Math.max(0.2, Math.min(1.6, (areaW - 56) / current.width)) : 1;
  const scale = zoom === 'fit' ? fitScale : zoom;

  const zoomStep = useCallback(
    (dir: 1 | -1) => {
      setZoom((z) => {
        const cur = z === 'fit' ? fitScale : z;
        const next = dir > 0 ? ZOOMS.find((v) => v > cur + 0.001) : [...ZOOMS].reverse().find((v) => v < cur - 0.001);
        return next ?? cur;
      });
    },
    [fitScale],
  );

  const goTo = useCallback(
    (i: number) => {
      if (!pages) return;
      const p = pages[Math.max(0, Math.min(i, pages.length - 1))];
      if (p) go({ name: 'pagina', sectionId, pageId: p.id });
      areaRef.current?.scrollTo({ top: 0 });
    },
    [pages, sectionId],
  );

  // Atalhos: setas/PageUp/PageDown para trocar de página, Ctrl +/- para zoom.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || (e.target as HTMLElement)?.isContentEditable) return;
      if (e.key === 'PageDown' || (e.key === 'ArrowRight' && !e.ctrlKey)) goTo(idx + 1);
      else if (e.key === 'PageUp' || (e.key === 'ArrowLeft' && !e.ctrlKey)) goTo(idx - 1);
      else if ((e.ctrlKey || e.metaKey) && (e.key === '=' || e.key === '+')) {
        e.preventDefault();
        zoomStep(1);
      } else if ((e.ctrlKey || e.metaKey) && e.key === '-') {
        e.preventDefault();
        zoomStep(-1);
      } else if ((e.ctrlKey || e.metaKey) && e.key === '0') {
        e.preventDefault();
        setZoom('fit');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [goTo, idx, zoomStep]);

  // Ctrl + roda do mouse = zoom (sem dar zoom no site inteiro).
  useEffect(() => {
    const el = areaRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      zoomStep(e.deltaY < 0 ? 1 : -1);
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [zoomStep]);

  const onImportPdf = async (files: File[]) => {
    for (const f of files) {
      try {
        setPdfProgress({ name: f.name, done: 0, total: 0 });
        const res = await importPdf(f, sectionId, current?.order, (p) => setPdfProgress({ name: f.name, ...p }));
        if (res.firstPageId) go({ name: 'pagina', sectionId, pageId: res.firstPageId });
      } catch (err) {
        console.error(err);
        setPdfError(`Não foi possível importar ${f.name}. O arquivo pode estar protegido por senha ou danificado.`);
      } finally {
        setPdfProgress(null);
      }
    }
  };

  const newPageAfter = async () => {
    const id = await addPage(sectionId, idx);
    go({ name: 'pagina', sectionId, pageId: id });
  };

  if (!section || !pages || !current) return <div className="nb" />;

  const sectionIndex = sections?.findIndex((s) => s.id === section.id) ?? 0;

  return (
    <div className="nb">
      <header className="topbar" style={{ position: 'relative' }}>
        <button className="icon-btn" onClick={() => go({ name: 'capa' })} title="Capa">
          <Icon name="home" />
        </button>
        <button className="icon-btn" onClick={() => go({ name: 'indice' })} title="Índice">
          <Icon name="list" />
        </button>
        <button className={`icon-btn ${sidebar ? 'active' : ''}`} onClick={() => setSidebar((s: boolean) => !s)} title="Miniaturas">
          <Icon name="panel" />
        </button>
        <button className="icon-btn hide-sm" onClick={() => go({ name: 'busca' })} title="Buscar no caderno">
          <Icon name="search" />
        </button>
        <span className="sep" />
        <span className="title" title={section.title}>
          <span style={{ fontFamily: 'var(--font-hand)', fontSize: 21, color: numberColor(sectionIndex), marginRight: 8 }}>{section.number}</span>
          <span className="hide-sm">{section.title}</span>
        </span>
        <input
          className="page-title-input"
          placeholder={`Página ${idx + 1}`}
          value={current.title}
          onChange={(e) => updatePage(current.id, { title: e.target.value })}
          aria-label="Título da página"
        />

        <span className="spacer" />

        <button
          className={`icon-btn star ${current.favorite ? 'on' : ''}`}
          onClick={() => updatePage(current.id, { favorite: current.favorite ? 0 : 1 })}
          title="Favoritar página"
        >
          <Icon name="star" fill={current.favorite ? 'currentColor' : 'none'} />
        </button>
        <button
          className={`icon-btn ${current.bookmarked ? 'active' : ''}`}
          onClick={() => updatePage(current.id, { bookmarked: current.bookmarked ? 0 : 1 })}
          title="Marcador"
        >
          <Icon name="bookmark" fill={current.bookmarked ? 'currentColor' : 'none'} />
        </button>
        <button className={`icon-btn ${tagsOpen || current.tags.length ? 'active' : ''}`} onClick={() => setTagsOpen((o) => !o)} title="Tags da página">
          <svg viewBox="0 0 24 24" width={19} height={19} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M20.6 13.4l-7.2 7.2a2 2 0 0 1-2.8 0L2 12V2h10l8.6 8.6a2 2 0 0 1 0 2.8zM7 7h.01" />
          </svg>
        </button>
        <button className={`icon-btn ${tplOpen ? 'active' : ''}`} onClick={() => setTplOpen((o) => !o)} title="Modelo da página">
          <Icon name="paper" />
        </button>
        <span className="sep hide-sm" />
        <button className="icon-btn hide-sm" onClick={() => zoomStep(-1)} title="Diminuir zoom (Ctrl -)">
          <Icon name="minus" />
        </button>
        <button className="zoom-label hide-sm" onClick={() => setZoom('fit')} title="Ajustar à largura (Ctrl 0)">
          {Math.round(scale * 100)}%
        </button>
        <button className="icon-btn hide-sm" onClick={() => zoomStep(1)} title="Aumentar zoom (Ctrl +)">
          <Icon name="plus" />
        </button>
        <span className="sep" />
        <button className="icon-btn" disabled={idx <= 0} onClick={() => goTo(idx - 1)} title="Página anterior">
          <Icon name="back" />
        </button>
        <span className="page-nav">
          {idx + 1} / {pages.length}
        </span>
        <button className="icon-btn" disabled={idx >= pages.length - 1} onClick={() => goTo(idx + 1)} title="Próxima página">
          <Icon name="next" />
        </button>
        <button className="btn" onClick={newPageAfter} title="Nova página depois desta">
          <Icon name="plus" width={16} /> <span className="hide-sm">Página</span>
        </button>
        <span className={`save-indicator hide-sm ${saving ? 'saving' : ''}`} style={{ marginLeft: 6 }}>
          <span className="dot" /> {saving ? 'Salvando…' : 'Salvo'}
        </span>
        {tplOpen && <TemplatePopover page={current} onClose={() => setTplOpen(false)} right={110} />}
        {tagsOpen && <TagsPopover page={current} onClose={() => setTagsOpen(false)} right={150} />}
      </header>

      <Toolstrip tool={tool} setTool={setTool} settings={settings} setSettings={setSettings} status={status} api={editorApi} onImportPdf={onImportPdf} />
      {pdfProgress && (
        <div className="toast" role="status">
          <span>
            Importando <b>{pdfProgress.name}</b>: página {pdfProgress.done} de {pdfProgress.total || '…'}
          </span>
          <span className="progress">
            <span style={{ width: `${pdfProgress.total ? (pdfProgress.done / pdfProgress.total) * 100 : 5}%` }} />
          </span>
        </div>
      )}
      {pdfError && (
        <div className="toast" role="alert">
          <span>{pdfError}</span>
          <button className="btn" onClick={() => setPdfError(null)}>
            Fechar
          </button>
        </div>
      )}

      <div className="nb-body">
        <aside className={`sidebar ${sidebar ? '' : 'closed'}`}>
          <div className="sidebar-tabs">
            <button className={sideTab === 'paginas' ? 'on' : ''} onClick={() => setSideTab('paginas')}>
              Páginas
            </button>
            <button className={sideTab === 'aulas' ? 'on' : ''} onClick={() => setSideTab('aulas')}>
              Aulas
            </button>
          </div>
          <div className="sidebar-scroll">
            {sideTab === 'paginas' ? (
              <Thumbnails pages={pages} currentId={current.id} sectionId={sectionId} />
            ) : (
              <div className="side-toc">
                {sections?.map((s, i) => (
                  <button key={s.id} className={s.id === sectionId ? 'on' : ''} onClick={() => go({ name: 'pagina', sectionId: s.id })}>
                    <span className="n" style={{ color: numberColor(i) }}>
                      {s.number}
                    </span>
                    <span>{s.title}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </aside>

        <main className="canvas-area" ref={areaRef}>
          <div className="canvas-inner">
            <div className="paper" style={{ width: current.width * scale, height: current.height * scale }}>
              <PaperCanvas template={current.template} width={current.width} height={current.height} scale={scale} />
              <Editor
                key={current.id}
                ref={editorApi}
                page={current}
                scale={scale}
                tool={tool}
                settings={settings}
                onStatus={onStatus}
                onToolChange={setTool}
              />
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

function Thumbnails({ pages, currentId, sectionId }: { pages: Page[]; currentId: string; sectionId: string }) {
  const [dragId, setDragId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const [menuId, setMenuId] = useState<string | null>(null);

  return (
    <>
      {pages.map((p, i) => (
        <div
          key={p.id}
          className={`thumb ${p.id === currentId ? 'current' : ''} ${overId === p.id && dragId !== p.id ? 'drag-over' : ''}`}
          draggable
          onDragStart={(e) => {
            e.dataTransfer.effectAllowed = 'move';
            setDragId(p.id);
          }}
          onDragOver={(e) => {
            e.preventDefault();
            setOverId(p.id);
          }}
          onDrop={async (e) => {
            e.preventDefault();
            if (dragId && dragId !== p.id) await reorderPage(dragId, i);
            setDragId(null);
            setOverId(null);
          }}
          onDragEnd={() => {
            setDragId(null);
            setOverId(null);
          }}
        >
          <button style={{ display: 'block', width: '100%' }} onClick={() => go({ name: 'pagina', sectionId, pageId: p.id })} aria-label={`Página ${i + 1}`}>
            <span className="thumb-stack">
              <PaperCanvas className="thumb-img" template={p.template} width={p.width} height={p.height} scale={180 / p.width} style={{ width: '100%', height: 'auto' }} />
              {p.thumbnail ? <img className="thumb-ink" src={p.thumbnail} alt="" /> : null}
            </span>
          </button>
          <div className="thumb-badges">
            {p.favorite ? <Icon name="star" fill="currentColor" /> : null}
            {p.bookmarked ? <Icon name="bookmark" fill="currentColor" style={{ color: 'var(--lavanda)' }} /> : null}
          </div>
          <div className="thumb-actions">
            <button className="icon-btn" onClick={() => setMenuId(menuId === p.id ? null : p.id)} title="Opções da página">
              <Icon name="more" />
            </button>
            {menuId === p.id && <PageMenu page={p} index={i} total={pages.length} onClose={() => setMenuId(null)} />}
          </div>
          <div className="thumb-label">{p.title || i + 1}</div>
        </div>
      ))}
      <button
        className="add-page-btn"
        onClick={async () => {
          const id = await addPage(sectionId);
          go({ name: 'pagina', sectionId, pageId: id });
        }}
        title="Adicionar página no final"
      >
        <Icon name="plus" width={22} />
      </button>
    </>
  );
}

function PageMenu({ page, index, total, onClose }: { page: Page; index: number; total: number; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const [confirm, setConfirm] = useState(false);
  useOutside(ref, true, onClose);
  const act = (fn: () => unknown) => async () => {
    await fn();
    onClose();
  };
  return (
    <div className="menu" ref={ref}>
      <button onClick={act(() => addPage(page.sectionId, index))}>
        <Icon name="plus" width={16} /> Nova página depois
      </button>
      <button onClick={act(() => duplicatePage(page.id))}>
        <Icon name="copy" width={16} /> Duplicar
      </button>
      <button disabled={index === 0} onClick={act(() => reorderPage(page.id, index - 1))}>
        <Icon name="up" width={16} /> Mover para cima
      </button>
      <button disabled={index === total - 1} onClick={act(() => reorderPage(page.id, index + 1))}>
        <Icon name="down" width={16} /> Mover para baixo
      </button>
      <hr />
      {confirm ? (
        <button style={{ color: 'var(--danger)' }} onClick={act(() => deletePage(page.id))}>
          <Icon name="check" width={16} /> Confirmar exclusão
        </button>
      ) : (
        <button style={{ color: 'var(--danger)' }} onClick={() => setConfirm(true)}>
          <Icon name="trash" width={16} /> Excluir página
        </button>
      )}
    </div>
  );
}

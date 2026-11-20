import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useState } from 'react';
import { assetUrl, formatBytes, kindOf, openAsset, pickFiles, saveFile, saveImage } from '../assets';
import { db, NOTEBOOK_ID } from '../db';
import { Icon } from '../icons';
import { importPdf } from '../pdf';
import { go } from '../router';
import type { Asset, AssetKind } from '../types';
import { Shell } from './Shell';

type Filter = 'todos' | AssetKind;
const FILTERS: Array<[Filter, string]> = [
  ['todos', 'Todos'],
  ['pdf', 'PDFs'],
  ['imagem', 'Imagens'],
  ['documento', 'Documentos'],
  ['sticker', 'Meus stickers'],
];

export function LibraryView() {
  const [filter, setFilter] = useState<Filter>('todos');
  const [target, setTarget] = useState<string>('');
  const [busy, setBusy] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [usage, setUsage] = useState<string>('');
  const sections = useLiveQuery(() => db.sections.where('notebookId').equals(NOTEBOOK_ID).sortBy('order'));
  const assets = useLiveQuery(() => db.assets.orderBy('createdAt').reverse().filter((a) => a.kind !== 'pagina-pdf').toArray());
  const pdfThumbs = useLiveQuery(async () => {
    const map: Record<string, Asset> = {};
    await db.assets
      .where('kind')
      .equals('pagina-pdf')
      .each((a) => {
        if (a.parentId && (!map[a.parentId] || a.createdAt < map[a.parentId].createdAt)) map[a.parentId] = a;
      });
    return map;
  });

  useEffect(() => {
    navigator.storage
      ?.estimate?.()
      .then((e) => setUsage(`${formatBytes(e.usage ?? 0)} usados`))
      .catch(() => {});
  }, [assets]);

  useEffect(() => {
    if (!target && sections?.length) setTarget(sections[0].id);
  }, [sections, target]);

  const visible = (assets ?? []).filter((a) => filter === 'todos' || a.kind === filter);
  const sectionName = (id?: string) => {
    const s = sections?.find((x) => x.id === id);
    return s ? `${s.number} · ${s.title}` : '';
  };

  const upload = async () => {
    const files = await pickFiles('*/*');
    for (const f of files) {
      const kind = kindOf(f);
      if (kind === 'pdf') {
        setBusy(`Importando ${f.name}…`);
        try {
          await importPdf(f, target, undefined, (p) => setBusy(`Importando ${f.name}: página ${p.done} de ${p.total}`));
        } catch {
          setBusy(null);
          alertBox(`Não foi possível importar ${f.name}.`);
        }
      } else if (kind === 'imagem') await saveImage(f, f.name);
      else await saveFile(f, kind);
    }
    setBusy(null);
  };
  const [msg, alertBox] = useState<string | null>(null);

  const openPdf = async (a: Asset) => {
    const pageImg = pdfThumbs?.[a.id];
    if (pageImg) {
      const page = await db.pages.filter((p) => p.background?.assetId === pageImg.id).first();
      if (page) return go({ name: 'pagina', sectionId: page.sectionId, pageId: page.id });
    }
    openAsset(a.id);
  };

  const remove = async (a: Asset) => {
    await db.assets.delete(a.id); // páginas do PDF já importadas continuam no caderno
    setConfirmId(null);
  };

  return (
    <Shell title="Biblioteca de arquivos">
      <h1>Biblioteca</h1>
      <p className="sheet-sub">PDFs, imagens, documentos e stickers guardados neste caderno. {usage}</p>

      <div className="toolbar-row">
        {FILTERS.map(([f, label]) => (
          <button key={f} className={`chip-filter ${filter === f ? 'on' : ''}`} onClick={() => setFilter(f)}>
            {label}
          </button>
        ))}
      </div>
      <div className="toolbar-row">
        <button className="btn primary" onClick={upload} disabled={!!busy}>
          <Icon name="plus" width={16} /> Adicionar arquivos
        </button>
        <label className="hint" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          PDFs entram como páginas da aula
          <select id="lib-target" className="mini-select" value={target} onChange={(e) => setTarget(e.target.value)}>
            {sections?.map((s) => (
              <option key={s.id} value={s.id}>
                {s.number} · {s.title}
              </option>
            ))}
          </select>
        </label>
      </div>
      {busy && <p className="hint">{busy}</p>}
      {msg && (
        <p className="hint" style={{ color: 'var(--danger)' }}>
          {msg}
        </p>
      )}

      {visible.length === 0 ? (
        <div className="empty">Nada aqui ainda. Use "Adicionar arquivos", ou insira imagens, PDFs e documentos direto nas páginas.</div>
      ) : (
        <div className="lib-grid">
          {visible.map((a) => {
            const thumb = a.kind === 'pdf' ? pdfThumbs?.[a.id] : a.kind === 'imagem' || a.kind === 'sticker' ? a : undefined;
            return (
              <div key={a.id} className="lib-card">
                <button className="lib-preview" onClick={() => (a.kind === 'pdf' ? openPdf(a) : openAsset(a.id))} title="Abrir">
                  {thumb ? <img src={assetUrl(thumb)} alt="" /> : <span className="lib-ext">{ext(a.name)}</span>}
                  <span className={`lib-kind k-${a.kind}`}>{KIND_LABEL[a.kind]}</span>
                </button>
                <div className="lib-name" title={a.name}>
                  {a.name}
                </div>
                <div className="lib-meta">
                  {formatBytes(a.size)}
                  {a.pageCount ? ` · ${a.pageCount} pág.` : ''}
                  {a.sectionId ? ` · ${sectionName(a.sectionId)}` : ''}
                </div>
                <div className="lib-actions">
                  {a.kind === 'pdf' && (
                    <button className="btn ghost" onClick={() => openPdf(a)}>
                      Ver no caderno
                    </button>
                  )}
                  {a.kind !== 'pdf' && (
                    <button className="btn ghost" onClick={() => openAsset(a.id)}>
                      Abrir
                    </button>
                  )}
                  {confirmId === a.id ? (
                    <button className="btn danger" onClick={() => remove(a)}>
                      Confirmar
                    </button>
                  ) : (
                    <button className="icon-btn" title="Excluir da biblioteca" onClick={() => setConfirmId(a.id)}>
                      <Icon name="trash" />
                    </button>
                  )}
                </div>
                {confirmId === a.id && (
                  <p className="hint" style={{ whiteSpace: 'normal', margin: 0 }}>
                    {a.kind === 'pdf' ? 'Apaga o PDF original. As páginas já importadas continuam no caderno.' : 'Onde ele foi inserido, vai aparecer um espaço vazio.'}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </Shell>
  );
}

const KIND_LABEL: Record<AssetKind, string> = { pdf: 'PDF', imagem: 'Imagem', documento: 'Documento', sticker: 'Sticker', 'pagina-pdf': 'Página' };
const ext = (name: string) => (name.split('.').pop() ?? 'arq').slice(0, 5).toUpperCase();

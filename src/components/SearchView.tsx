import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { db } from '../db';
import { go } from '../router';
import type { Page, Section } from '../types';
import { Shell } from './Shell';

interface Hit {
  page: Page;
  section?: Section;
  where: string; // onde achou (título, tag, texto…)
  snippet: string;
}

function norm(s: string) {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

function snippetAround(text: string, q: string) {
  const i = norm(text).indexOf(q);
  if (i < 0) return text.slice(0, 120);
  const start = Math.max(0, i - 40);
  return (start ? '…' : '') + text.slice(start, i + q.length + 70) + (i + q.length + 70 < text.length ? '…' : '');
}

export function SearchView({ initial = '' }: { initial?: string }) {
  const [q, setQ] = useState(initial);
  const nq = norm(q.trim());

  const results = useLiveQuery(async () => {
    if (nq.length < 2) return null;
    const sections = await db.sections.toArray();
    const byId = new Map(sections.map((s) => [s.id, s]));
    const secHits = sections.filter((s) => norm(`${s.number} ${s.title} ${s.tags.join(' ')}`).includes(nq)).sort((a, b) => a.order - b.order);
    const hits: Hit[] = [];
    await db.pages.each((page) => {
      const section = byId.get(page.sectionId);
      if (norm(page.title).includes(nq)) hits.push({ page, section, where: 'Título', snippet: page.title });
      const tag = page.tags.find((t) => norm(t).includes(nq));
      if (tag) hits.push({ page, section, where: 'Tag', snippet: `#${tag}` });
      for (const el of page.elements) {
        const text = el.type === 'text' ? el.text : el.type === 'link' ? `${el.label} ${el.url ?? ''}` : '';
        if (text && norm(text).includes(nq)) {
          hits.push({ page, section, where: el.type === 'text' ? 'Texto digitado' : 'Link', snippet: snippetAround(text, nq) });
          break;
        }
      }
    });
    const assets = await db.assets.filter((a) => a.kind !== 'pagina-pdf' && norm(a.name).includes(nq)).toArray();
    return { secHits, hits, assets };
  }, [nq]);

  return (
    <Shell title="Buscar">
      <h1>Buscar</h1>
      <p className="sheet-sub">Procura em aulas, títulos de páginas, tags, textos digitados, links e arquivos.</p>
      <input
        id="search-input"
        className="text-input"
        autoFocus
        placeholder="Ex.: flavonoides, prova-1, ácido gálico…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        style={{ width: '100%', fontSize: 16, padding: '10px 12px', marginBottom: 18 }}
      />
      <p className="hint" style={{ whiteSpace: 'normal', marginTop: -8 }}>
        A escrita à mão não entra na busca, porque o navegador não reconhece letra cursiva. Use tags ou texto digitado para o que quiser achar depois.
      </p>
      {results === null && <div className="empty">Digite pelo menos 2 letras.</div>}
      {results && (
        <>
          {results.secHits.length > 0 && (
            <>
              <h3 className="section-label">Aulas</h3>
              <div className="side-toc" style={{ maxWidth: 560 }}>
                {results.secHits.map((s) => (
                  <button key={s.id} onClick={() => go({ name: 'pagina', sectionId: s.id })}>
                    <span className="n">{s.number}</span>
                    <span>{s.title}</span>
                  </button>
                ))}
              </div>
            </>
          )}
          <h3 className="section-label" style={{ marginTop: 20 }}>
            Páginas ({results.hits.length})
          </h3>
          {results.hits.length === 0 ? (
            <div className="empty">Nenhuma página encontrada.</div>
          ) : (
            <ul className="result-list">
              {results.hits.map((h, i) => (
                <li key={h.page.id + i}>
                  <button onClick={() => go({ name: 'pagina', sectionId: h.page.sectionId, pageId: h.page.id })}>
                    <span className="r-where">{h.where}</span>
                    <span className="r-snippet">{h.snippet}</span>
                    <span className="r-loc">
                      {h.section?.number} · {h.section?.title} · {h.page.title || `página ${h.page.order + 1}`}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {results.assets.length > 0 && (
            <>
              <h3 className="section-label" style={{ marginTop: 20 }}>
                Arquivos
              </h3>
              <ul className="result-list">
                {results.assets.map((a) => (
                  <li key={a.id}>
                    <button onClick={() => go({ name: 'biblioteca' })}>
                      <span className="r-where">{a.kind.toUpperCase()}</span>
                      <span className="r-snippet">{a.name}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </>
      )}
    </Shell>
  );
}

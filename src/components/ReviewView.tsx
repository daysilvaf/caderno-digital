import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { db, NOTEBOOK_ID, updateSection } from '../db';
import { go } from '../router';
import type { SectionStatus } from '../types';
import { STATUS_LABEL, STATUS_ORDER } from '../types';
import { PageGrid } from './FavoritesView';
import { Shell } from './Shell';

export function ReviewView() {
  const [tag, setTag] = useState<string | null>(null);
  const data = useLiveQuery(async () => {
    const sections = await db.sections.where('notebookId').equals(NOTEBOOK_ID).sortBy('order');
    const byId = new Map(sections.map((s) => [s.id, s]));
    const pages = await db.pages.toArray();
    const tags = new Map<string, number>();
    pages.forEach((p) => p.tags.forEach((t) => tags.set(t, (tags.get(t) ?? 0) + 1)));
    const marked = pages.filter((p) => p.bookmarked);
    return { sections, byId, pages, tags: [...tags.entries()].sort((a, b) => b[1] - a[1]), marked };
  });
  if (!data) return <Shell title="Revisão">{null}</Shell>;

  const counts = STATUS_ORDER.map((st) => [st, data.sections.filter((s) => s.status === st).length] as const);
  const total = data.sections.length || 1;
  const pending = data.sections.filter((s) => s.status === 'revisar' || s.status === 'em-andamento');
  const tagged = tag ? data.pages.filter((p) => p.tags.includes(tag)) : [];

  return (
    <Shell title="Revisão">
      <h1>Revisão</h1>
      <p className="sheet-sub">Acompanhe o que falta estudar e volte direto às páginas marcadas.</p>

      <div className="status-bar" aria-label="Progresso das aulas">
        {counts.map(([st, n]) => (n ? <span key={st} className={`status ${st}`} style={{ flex: n / total }} title={`${STATUS_LABEL[st]}: ${n}`} /> : null))}
      </div>
      <div className="toolbar-row" style={{ marginTop: 8 }}>
        {counts.map(([st, n]) => (
          <span key={st} className="hint">
            <span className={`dot-status ${st}`} /> {STATUS_LABEL[st]}: {n}
          </span>
        ))}
      </div>

      <h3 className="section-label" style={{ marginTop: 22 }}>
        Para revisar e em andamento
      </h3>
      {pending.length === 0 ? (
        <div className="empty">Nenhuma aula marcada como "Revisar" ou "Em andamento". Mude o status no índice.</div>
      ) : (
        <ul className="toc">
          {pending.map((s) => (
            <li key={s.id} className="toc-row review-row">
              <span />
              <span className="toc-num">{s.number}</span>
              <button className="toc-title" onClick={() => go({ name: 'pagina', sectionId: s.id })}>
                {s.title}
              </button>
              <select className={`status status-select ${s.status}`} value={s.status} onChange={(e) => updateSection(s.id, { status: e.target.value as SectionStatus })} aria-label="Status">
                {STATUS_ORDER.map((st) => (
                  <option key={st} value={st}>
                    {STATUS_LABEL[st]}
                  </option>
                ))}
              </select>
              <button className="btn ghost" onClick={() => updateSection(s.id, { status: 'concluida' })}>
                Revisei
              </button>
            </li>
          ))}
        </ul>
      )}

      <h3 className="section-label" style={{ marginTop: 26 }}>
        Estudar por tag
      </h3>
      {data.tags.length === 0 ? (
        <div className="empty">Nenhuma tag ainda. Na página, use o botão de etiqueta na barra de cima (por exemplo: prova-1, mecanismo, decorar).</div>
      ) : (
        <div className="tags-wrap">
          {data.tags.map(([t, n]) => (
            <button key={t} className={`chip-filter ${tag === t ? 'on' : ''}`} onClick={() => setTag(tag === t ? null : t)}>
              #{t} · {n}
            </button>
          ))}
        </div>
      )}
      {tag && <PageGrid pages={tagged} byId={data.byId} empty="Nenhuma página com essa tag." />}

      <h3 className="section-label" style={{ marginTop: 26 }}>
        Páginas com marcador
      </h3>
      <PageGrid pages={data.marked} byId={data.byId} empty="Nenhuma página com marcador. Use o ícone de marcador na barra do caderno." />
    </Shell>
  );
}

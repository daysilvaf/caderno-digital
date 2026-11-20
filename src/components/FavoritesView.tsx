import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { Icon } from '../icons';
import { go } from '../router';
import type { Page, Section } from '../types';
import { PaperCanvas } from './PaperCanvas';

export function FavoritesView() {
  const data = useLiveQuery(async () => {
    const sections = await db.sections.toArray();
    const byId = new Map(sections.map((s) => [s.id, s]));
    const favPages = await db.pages.where('favorite').equals(1).toArray();
    const marked = await db.pages.where('bookmarked').equals(1).toArray();
    const favSections = sections.filter((s) => s.favorite).sort((a, b) => a.order - b.order);
    return { byId, favPages, marked, favSections };
  });

  return (
    <div className="sheet-screen">
      <header className="topbar">
        <button className="icon-btn" onClick={() => go({ name: 'capa' })} title="Capa">
          <Icon name="home" />
        </button>
        <button className="icon-btn" onClick={() => go({ name: 'indice' })} title="Índice">
          <Icon name="list" />
        </button>
        <span className="title">Favoritos e marcadores</span>
      </header>
      <div className="sheet-scroll">
        <div className="sheet">
          <h1>Favoritos</h1>
          <p className="sheet-sub">Aulas e páginas marcadas com estrela, e páginas com marcador.</p>
          {data && (
            <>
              <h3 className="section-label">Aulas favoritas</h3>
              {data.favSections.length === 0 ? (
                <div className="empty">Nenhuma aula favorita. Use a estrela no índice.</div>
              ) : (
                <div className="side-toc" style={{ maxWidth: 520 }}>
                  {data.favSections.map((s) => (
                    <button key={s.id} onClick={() => go({ name: 'pagina', sectionId: s.id })}>
                      <span className="n">{s.number}</span>
                      <span>{s.title}</span>
                    </button>
                  ))}
                </div>
              )}
              <h3 className="section-label" style={{ marginTop: 26 }}>
                Páginas favoritas
              </h3>
              <PageGrid pages={data.favPages} byId={data.byId} empty="Nenhuma página favorita. Use a estrela na barra do caderno." />
              <h3 className="section-label" style={{ marginTop: 26 }}>
                Marcadores
              </h3>
              <PageGrid pages={data.marked} byId={data.byId} empty="Nenhuma página com marcador." />
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export function PageGrid({ pages, byId, empty }: { pages: Page[]; byId: Map<string, Section>; empty: string }) {
  if (pages.length === 0) return <div className="empty">{empty}</div>;
  return (
    <div className="fav-list" style={{ marginTop: 12 }}>
      {pages.map((p) => {
        const s = byId.get(p.sectionId);
        return (
          <button key={p.id} className="fav-card" onClick={() => go({ name: 'pagina', sectionId: p.sectionId, pageId: p.id })}>
            <span className="thumb-stack">
              <PaperCanvas template={p.template} width={p.width} height={p.height} scale={150 / p.width} style={{ width: '100%', height: 'auto', borderRadius: 4 }} />
              {p.thumbnail ? <img className="thumb-ink" src={p.thumbnail} alt="" /> : null}
            </span>
            <div className="t">{p.title || `Página ${p.order + 1}`}</div>
            <div className="s">
              {s?.number} · {s?.title}
            </div>
          </button>
        );
      })}
    </div>
  );
}

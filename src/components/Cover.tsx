import { useLiveQuery } from 'dexie-react-hooks';
import { db, NOTEBOOK_ID, updateNotebook } from '../db';
import { Icon } from '../icons';
import { go, lastPage } from '../router';

const COVER_COLORS = ['#b9a7e8', '#d7b8f3', '#f4b8cf', '#a9cdf2', '#b4e3c4', '#f5e1a4', '#3a3a42', '#f6f2ea'];

export function CoverArt() {
  return (
    <svg viewBox="0 0 240 220" fill="none" strokeLinecap="round" strokeLinejoin="round">
      {/* molécula (anel aromático com substituintes) */}
      <g stroke="#2a2340" strokeWidth="3.2">
        <path d="M150 40 l26 15 v30 l-26 15 l-26 -15 v-30 z" />
        <path d="M150 50 l17 10 M167 84 l-17 10 M133 60 v20" strokeWidth="2.4" />
        <path d="M176 55 l22 -13 M198 42 l18 6" />
        <path d="M150 100 v22" />
        <circle cx="150" cy="128" r="6" fill="#f4b8cf" />
        <circle cx="222" cy="50" r="6" fill="#a9cdf2" />
      </g>
      {/* folha / ramo */}
      <g stroke="#2a2340" strokeWidth="3">
        <path d="M40 200 C 60 150, 80 120, 120 100" />
        <path d="M70 150 C 40 140, 30 112, 42 92 C 68 100, 80 124, 70 150 z" fill="#b4e3c4" />
        <path d="M92 124 C 92 96, 108 78, 132 76 C 134 100, 118 120, 92 124 z" fill="#b4e3c4" />
        <path d="M55 178 C 30 178, 16 160, 16 142 C 40 142, 54 158, 55 178 z" fill="#d6f0de" />
      </g>
      {/* tubo de ensaio */}
      <g stroke="#2a2340" strokeWidth="3" transform="rotate(18 190 160)">
        <path d="M178 118 v66 a12 12 0 0 0 24 0 v-66" />
        <path d="M174 118 h32" />
        <path d="M178 160 h24 v24 a12 12 0 0 1 -24 0 z" fill="#d7b8f3" />
      </g>
      {/* brilhos */}
      <g fill="#fff" stroke="#2a2340" strokeWidth="2">
        <path d="M30 40 l4 10 l10 4 l-10 4 l-4 10 l-4 -10 l-10 -4 l10 -4 z" />
        <path d="M110 30 l2.5 6 l6 2.5 l-6 2.5 l-2.5 6 l-2.5 -6 l-6 -2.5 l6 -2.5 z" />
      </g>
    </svg>
  );
}

export function Cover() {
  const nb = useLiveQuery(() => db.notebooks.get(NOTEBOOK_ID));
  const stats = useLiveQuery(async () => {
    const [sections, pages] = await Promise.all([db.sections.count(), db.pages.count()]);
    return { sections, pages };
  });
  const resume = useLiveQuery(async () => {
    const r = lastPage();
    if (!r) return null;
    const s = await db.sections.get(r.sectionId);
    return s ? { r, label: `${s.number} · ${s.title}` } : null;
  });
  if (!nb) return null;
  const dark = nb.coverColor === '#3a3a42';

  return (
    <div className="cover-screen">
      <div className="cover-wrap">
        <button className="cover" style={{ background: nb.coverColor }} onClick={() => go({ name: 'indice' })} aria-label="Abrir o caderno">
          <div className="cover-art" style={dark ? { filter: 'invert(1) hue-rotate(180deg)' } : undefined}>
            <CoverArt />
          </div>
          <div className="label" style={{ textAlign: 'left' }}>
            <h1>{nb.title}</h1>
            <div className="subtitle">{nb.subtitle}</div>
            <div className="meta">
              Farmácia · {stats?.sections ?? 0} aulas · {stats?.pages ?? 0} páginas
            </div>
          </div>
        </button>

        <div className="cover-side">
          <h2>Abrir</h2>
          <nav className="cover-nav">
            {resume && (
              <button className="btn primary resume" onClick={() => go(resume.r)}>
                <Icon name="book" /> <span>Continuar de onde parei<small>{resume.label}</small></span>
              </button>
            )}
            <button className={`btn ${resume ? '' : 'primary'}`} onClick={() => go({ name: 'indice' })}>
              <Icon name="list" /> Índice das aulas
            </button>
            <button className="btn" onClick={() => go({ name: 'favoritos' })}>
              <Icon name="star" /> Favoritos e marcadores
            </button>
            <button className="btn" onClick={() => go({ name: 'biblioteca' })}>
              <Icon name="folder" /> Biblioteca de arquivos
            </button>
            <button className="btn" onClick={() => go({ name: 'revisao' })}>
              <Icon name="brain" /> Revisão
            </button>
            <button className="btn" onClick={() => go({ name: 'busca' })}>
              <Icon name="search" /> Buscar no caderno
            </button>
            <button className="btn" onClick={() => go({ name: 'ajustes' })}>
              <Icon name="cloud" /> Sincronização e backup
            </button>
          </nav>

          <div className="section-label">Cor da capa</div>
          <div className="swatches">
            {COVER_COLORS.map((c) => (
              <button
                key={c}
                className={`swatch ${nb.coverColor === c ? 'on' : ''}`}
                style={{ background: c }}
                aria-label={`Cor ${c}`}
                onClick={() => updateNotebook({ coverColor: c })}
              />
            ))}
            <label className="swatch swatch-custom" title="Outra cor">
              <input type="color" value={nb.coverColor} onChange={(e) => updateNotebook({ coverColor: e.target.value })} />
            </label>
          </div>
        </div>
      </div>
    </div>
  );
}

import { Icon } from '../icons';
import { go } from '../router';

/** Moldura das telas de organização (índice, favoritos, biblioteca, busca, revisão). */
export function Shell({ title, children, actions }: { title: string; children: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <div className="sheet-screen">
      <header className="topbar">
        <button className="icon-btn" onClick={() => go({ name: 'capa' })} title="Capa">
          <Icon name="home" />
        </button>
        <button className="icon-btn" onClick={() => go({ name: 'indice' })} title="Índice">
          <Icon name="list" />
        </button>
        <span className="title">{title}</span>
        <span className="spacer" />
        {actions}
        <button className="icon-btn" onClick={() => go({ name: 'busca' })} title="Buscar no caderno">
          <Icon name="search" />
        </button>
        <button className="icon-btn" onClick={() => go({ name: 'favoritos' })} title="Favoritos">
          <Icon name="star" />
        </button>
        <button className="icon-btn" onClick={() => go({ name: 'biblioteca' })} title="Biblioteca">
          <Icon name="folder" />
        </button>
        <button className="icon-btn" onClick={() => go({ name: 'revisao' })} title="Revisão">
          <Icon name="brain" />
        </button>
      </header>
      <div className="sheet-scroll">
        <div className="sheet">{children}</div>
      </div>
    </div>
  );
}

import { useEffect, useState } from 'react';
import { Cover } from './components/Cover';
import { FavoritesView } from './components/FavoritesView';
import { IndexView } from './components/IndexView';
import { NotebookView } from './components/NotebookView';
import { ensureSeed, requestPersistence } from './db';
import { Icon } from './icons';
import { go, useRoute } from './router';

export default function App() {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const route = useRoute();

  useEffect(() => {
    ensureSeed()
      .then(() => setReady(true))
      .catch((e) => setError(String(e)));
    requestPersistence();
  }, []);

  if (error) return <div style={{ padding: 24 }}>Não foi possível abrir o armazenamento do navegador: {error}</div>;
  if (!ready) return null;

  switch (route.name) {
    case 'indice':
      return <IndexView />;
    case 'favoritos':
      return <FavoritesView />;
    case 'pagina':
      return <NotebookView key={route.sectionId} sectionId={route.sectionId} pageId={route.pageId} />;
    case 'biblioteca':
      return <ComingSoon title="Biblioteca de arquivos" text="Aqui vão ficar os PDFs, imagens e documentos que você importar para o caderno. Essa parte chega no passo 3, junto com a importação de PDFs." />;
    case 'revisao':
      return <ComingSoon title="Revisão" text="Área para revisar o conteúdo por aula, status e tags. Chega no passo 3." />;
    default:
      return <Cover />;
  }
}

function ComingSoon({ title, text }: { title: string; text: string }) {
  return (
    <div className="sheet-screen">
      <header className="topbar">
        <button className="icon-btn" onClick={() => go({ name: 'capa' })} title="Capa">
          <Icon name="home" />
        </button>
        <span className="title">{title}</span>
      </header>
      <div className="sheet-scroll">
        <div className="sheet">
          <h1>{title}</h1>
          <p className="placeholder-screen" style={{ marginLeft: 0 }}>
            {text}
          </p>
        </div>
      </div>
    </div>
  );
}

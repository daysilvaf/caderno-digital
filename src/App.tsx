import { useEffect, useState } from 'react';
import { Cover } from './components/Cover';
import { FavoritesView } from './components/FavoritesView';
import { IndexView } from './components/IndexView';
import { NotebookView } from './components/NotebookView';
import { LibraryView } from './components/LibraryView';
import { ReviewView } from './components/ReviewView';
import { SearchView } from './components/SearchView';
import { SettingsView } from './components/SettingsView';
import { initSync } from './sync';
import { ensureSeed, requestPersistence } from './db';
import { useRoute } from './router';

export default function App() {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const route = useRoute();

  useEffect(() => {
    ensureSeed()
      .then(() => {
        setReady(true);
        initSync();
      })
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
      return <LibraryView />;
    case 'revisao':
      return <ReviewView />;
    case 'ajustes':
      return <SettingsView />;
    case 'busca':
      return <SearchView initial={route.q} />;
    default:
      return <Cover />;
  }
}

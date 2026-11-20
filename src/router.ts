import { useEffect, useState } from 'react';

export type Route =
  | { name: 'capa' }
  | { name: 'indice' }
  | { name: 'favoritos' }
  | { name: 'biblioteca' }
  | { name: 'revisao' }
  | { name: 'busca'; q?: string }
  | { name: 'ajustes' }
  | { name: 'pagina'; sectionId: string; pageId?: string };

/*
 * Navegação em memória, lembrada no navegador.
 * Ao recarregar ou reabrir o caderno, ele volta para a última tela/página aberta.
 * (Não usa a URL, para funcionar igual em qualquer hospedagem.)
 */
const KEY = 'caderno:rota';
const listeners = new Set<(r: Route) => void>();

function load(): Route {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw) as Route;
  } catch {
    /* sem armazenamento */
  }
  return { name: 'capa' };
}

let current: Route = load();

export function lastPage(): Extract<Route, { name: 'pagina' }> | null {
  try {
    const raw = localStorage.getItem('caderno:ultima-pagina');
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function go(r: Route, _replace = false) {
  current = r;
  try {
    localStorage.setItem(KEY, JSON.stringify(r));
    if (r.name === 'pagina') localStorage.setItem('caderno:ultima-pagina', JSON.stringify(r));
  } catch {
    /* sem armazenamento */
  }
  listeners.forEach((l) => l(r));
}

export function useRoute(): Route {
  const [route, setRoute] = useState(current);
  useEffect(() => {
    listeners.add(setRoute);
    return () => {
      listeners.delete(setRoute);
    };
  }, []);
  return route;
}

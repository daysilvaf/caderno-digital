import { useEffect, useState } from 'react';
import { db } from './db';

type Listener = (saving: boolean) => void;
const listeners = new Set<Listener>();
let timer: number | undefined;

function ping() {
  listeners.forEach((l) => l(true));
  window.clearTimeout(timer);
  timer = window.setTimeout(() => listeners.forEach((l) => l(false)), 600);
}

// Cada gravação no banco aciona o indicador "Salvando…".
for (const t of [db.pages, db.sections, db.notebooks, db.assets]) {
  t.hook('creating', ping);
  t.hook('updating', ping);
  t.hook('deleting', ping);
}

export function useSaving() {
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    listeners.add(setSaving);
    return () => {
      listeners.delete(setSaving);
    };
  }, []);
  return saving;
}

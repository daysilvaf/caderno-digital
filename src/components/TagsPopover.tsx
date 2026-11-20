import { useLiveQuery } from 'dexie-react-hooks';
import { useRef, useState } from 'react';
import { db } from '../db';
import { Icon } from '../icons';
import type { Page } from '../types';
import { useOutside } from './useOutside';

export function normalizeTag(t: string) {
  return t.trim().replace(/^#/, '').toLowerCase().replace(/\s+/g, '-').slice(0, 40);
}

export function TagsPopover({ page, onClose, right }: { page: Page; onClose: () => void; right: number }) {
  const ref = useRef<HTMLDivElement>(null);
  useOutside(ref, true, onClose);
  const [value, setValue] = useState('');
  const all = useLiveQuery(async () => {
    const set = new Set<string>();
    await db.pages.each((p) => p.tags.forEach((t) => set.add(t)));
    return [...set].sort();
  });
  // Lê a versão atual do banco para não perder tags adicionadas em sequência rápida.
  const add = async (t: string) => {
    const tag = normalizeTag(t);
    if (!tag) return;
    await db.pages
      .where('id')
      .equals(page.id)
      .modify((p) => {
        if (!p.tags.includes(tag)) p.tags = [...p.tags, tag];
        p.updatedAt = Date.now();
      });
  };
  const removeTag = (t: string) =>
    db.pages
      .where('id')
      .equals(page.id)
      .modify((p) => {
        p.tags = p.tags.filter((x) => x !== t);
        p.updatedAt = Date.now();
      });
  const suggestions = (all ?? []).filter((t) => !page.tags.includes(t) && t.includes(normalizeTag(value))).slice(0, 10);

  return (
    <div className="popover" ref={ref} style={{ right }}>
      <h4>Tags da página</h4>
      <div className="tags-wrap">
        {page.tags.length === 0 && <span className="hint">Nenhuma tag ainda.</span>}
        {page.tags.map((t) => (
          <span key={t} className="tag-chip">
            #{t}
            <button onClick={() => removeTag(t)} aria-label={`Remover ${t}`}>
              <Icon name="x" width={12} />
            </button>
          </span>
        ))}
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          add(value);
          setValue('');
        }}
      >
        <input id="tag-input" className="text-input" autoFocus placeholder="Nova tag e Enter (ex.: prova-1)" value={value} onChange={(e) => setValue(e.target.value)} style={{ width: '100%' }} />
      </form>
      {suggestions.length > 0 && (
        <div className="tags-wrap" style={{ marginTop: 10 }}>
          {suggestions.map((t) => (
            <button key={t} className="chip-filter" onClick={() => add(t)}>
              #{t}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

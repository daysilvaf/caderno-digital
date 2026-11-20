import { useLiveQuery } from 'dexie-react-hooks';
import { useCallback, useRef, useState } from 'react';
import { addSection, db, deleteSection, NOTEBOOK_ID, reorderSection, updateSection } from '../db';
import { Icon } from '../icons';
import { go } from '../router';
import type { Section, SectionStatus } from '../types';
import { STATUS_LABEL, STATUS_ORDER } from '../types';
import { useOutside } from './useOutside';

type Filter = 'todas' | 'favoritas' | SectionStatus;

export function IndexView() {
  const sections = useLiveQuery(() => db.sections.where('notebookId').equals(NOTEBOOK_ID).sortBy('order'));
  const pageCounts = useLiveQuery(async () => {
    const map: Record<string, number> = {};
    await db.pages.each((p) => {
      map[p.sectionId] = (map[p.sectionId] ?? 0) + 1;
    });
    return map;
  });
  const [filter, setFilter] = useState<Filter>('todas');
  const [query, setQuery] = useState('');
  const [dragId, setDragId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  const visible = (sections ?? []).filter((s) => {
    if (filter === 'favoritas' && !s.favorite) return false;
    if (filter !== 'todas' && filter !== 'favoritas' && s.status !== filter) return false;
    const q = query.trim().toLowerCase();
    if (q && !`${s.number} ${s.title} ${s.tags.join(' ')}`.toLowerCase().includes(q)) return false;
    return true;
  });
  const canDrag = filter === 'todas' && !query;

  const onDrop = async (targetId: string) => {
    if (!dragId || !sections || dragId === targetId) return;
    const to = sections.findIndex((s) => s.id === targetId);
    await reorderSection(dragId, to);
    setDragId(null);
    setOverId(null);
  };

  return (
    <div className="sheet-screen">
      <header className="topbar">
        <button className="icon-btn" onClick={() => go({ name: 'capa' })} title="Capa">
          <Icon name="home" />
        </button>
        <span className="title">Índice</span>
        <span className="spacer" />
        <button className="icon-btn" onClick={() => go({ name: 'busca' })} title="Buscar no caderno">
          <Icon name="search" />
        </button>
        <button className="icon-btn" onClick={() => go({ name: 'biblioteca' })} title="Biblioteca">
          <Icon name="folder" />
        </button>
        <button className="icon-btn" onClick={() => go({ name: 'revisao' })} title="Revisão">
          <Icon name="brain" />
        </button>
        <button className="btn ghost" onClick={() => go({ name: 'favoritos' })}>
          <Icon name="star" width={16} /> <span className="hide-sm">Favoritos</span>
        </button>
      </header>
      <div className="sheet-scroll">
        <div className="sheet">
          <h1>Índice</h1>
          <p className="sheet-sub">Química dos Produtos Naturais · arraste para reorganizar, clique no título para abrir</p>

          <div className="toolbar-row">
            <input className="text-input" placeholder="Buscar aula…" value={query} onChange={(e) => setQuery(e.target.value)} style={{ width: 200 }} />
            {(['todas', 'favoritas', ...STATUS_ORDER] as Filter[]).map((f) => (
              <button key={f} className={`chip-filter ${filter === f ? 'on' : ''}`} onClick={() => setFilter(f)}>
                {f === 'todas' ? 'Todas' : f === 'favoritas' ? 'Favoritas' : STATUS_LABEL[f]}
              </button>
            ))}
          </div>

          <ul className="toc">
            {visible.map((s) => (
              <SectionRow
                key={s.id}
                s={s}
                index={sections!.indexOf(s)}
                total={sections!.length}
                pages={pageCounts?.[s.id] ?? 0}
                draggable={canDrag}
                dragging={dragId === s.id}
                over={overId === s.id && dragId !== s.id}
                onDragStart={() => setDragId(s.id)}
                onDragOver={() => setOverId(s.id)}
                onDrop={() => onDrop(s.id)}
                onDragEnd={() => {
                  setDragId(null);
                  setOverId(null);
                }}
              />
            ))}
          </ul>
          {visible.length === 0 && <div className="empty">Nenhuma aula com esse filtro.</div>}

          {adding ? (
            <AddSectionForm onDone={() => setAdding(false)} nextNumber={String((sections?.length ?? 0) + 1).padStart(2, '0')} />
          ) : (
            <div className="add-row">
              <button className="btn" onClick={() => setAdding(true)}>
                <Icon name="plus" width={16} /> Nova aula
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function AddSectionForm({ onDone, nextNumber }: { onDone: () => void; nextNumber: string }) {
  const [number, setNumber] = useState(nextNumber);
  const [title, setTitle] = useState('');
  return (
    <form
      className="add-row"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!title.trim()) return;
        await addSection(number.trim() || nextNumber, title.trim());
        onDone();
      }}
    >
      <input className="text-input" value={number} onChange={(e) => setNumber(e.target.value)} style={{ width: 90 }} aria-label="Número" />
      <input className="text-input" autoFocus placeholder="Título da aula" value={title} onChange={(e) => setTitle(e.target.value)} style={{ flex: 1, minWidth: 180 }} />
      <button className="btn primary" type="submit">
        Adicionar
      </button>
      <button className="btn ghost" type="button" onClick={onDone}>
        Cancelar
      </button>
    </form>
  );
}

interface RowProps {
  s: Section;
  index: number;
  total: number;
  pages: number;
  draggable: boolean;
  dragging: boolean;
  over: boolean;
  onDragStart: () => void;
  onDragOver: () => void;
  onDrop: () => void;
  onDragEnd: () => void;
}

function SectionRow({ s, index, total, pages, draggable, dragging, over, onDragStart, onDragOver, onDrop, onDragEnd }: RowProps) {
  const [editing, setEditing] = useState(false);
  const [menu, setMenu] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const closeMenu = useCallback(() => {
    setMenu(false);
    setConfirmDelete(false);
  }, []);
  useOutside(menuRef, menu, closeMenu);

  const open = () => go({ name: 'pagina', sectionId: s.id });

  return (
    <li
      className={`toc-row ${dragging ? 'dragging' : ''} ${over ? 'drag-over' : ''}`}
      draggable={draggable && !editing}
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = 'move';
        onDragStart();
      }}
      onDragOver={(e) => {
        e.preventDefault();
        onDragOver();
      }}
      onDrop={(e) => {
        e.preventDefault();
        onDrop();
      }}
      onDragEnd={onDragEnd}
    >
      <span className="drag-handle" title={draggable ? 'Arraste para reordenar' : ''} style={{ opacity: draggable ? 1 : 0.2 }}>
        <Icon name="grip" width={16} />
      </span>
      {editing ? (
        <RenameFields s={s} onDone={() => setEditing(false)} />
      ) : (
        <>
          <span className="toc-num" style={{ color: numberColor(index) }}>
            {s.number}
          </span>
          <button className="toc-title" onClick={open} onDoubleClick={() => setEditing(true)} title="Abrir · duplo clique para renomear">
            {s.title}
          </button>
        </>
      )}
      <span className="toc-pages">
        {pages} {pages === 1 ? 'pág.' : 'págs.'}
      </span>
      <select
        className={`status status-select ${s.status}`}
        value={s.status}
        onChange={(e) => updateSection(s.id, { status: e.target.value as SectionStatus })}
        aria-label="Status"
      >
        {STATUS_ORDER.map((st) => (
          <option key={st} value={st}>
            {STATUS_LABEL[st]}
          </option>
        ))}
      </select>
      <button className={`icon-btn star ${s.favorite ? 'on' : ''}`} onClick={() => updateSection(s.id, { favorite: s.favorite ? 0 : 1 })} title="Favoritar">
        <Icon name="star" fill={s.favorite ? 'currentColor' : 'none'} />
      </button>
      <div className="row-menu" ref={menuRef}>
        <button className="icon-btn" onClick={() => setMenu((m) => !m)} title="Mais opções">
          <Icon name="more" />
        </button>
        {menu && (
          <div className="menu">
            <button onClick={() => (open(), closeMenu())}>
              <Icon name="book" width={16} /> Abrir
            </button>
            <button onClick={() => (setEditing(true), closeMenu())}>
              <Icon name="edit" width={16} /> Renomear
            </button>
            <button disabled={index === 0} onClick={() => (reorderSection(s.id, index - 1), closeMenu())}>
              <Icon name="up" width={16} /> Mover para cima
            </button>
            <button disabled={index === total - 1} onClick={() => (reorderSection(s.id, index + 1), closeMenu())}>
              <Icon name="down" width={16} /> Mover para baixo
            </button>
            <hr />
            {confirmDelete ? (
              <button className="btn danger" onClick={() => deleteSection(s.id)}>
                <Icon name="trash" width={16} /> Confirmar: apagar aula e páginas
              </button>
            ) : (
              <button style={{ color: 'var(--danger)' }} onClick={() => setConfirmDelete(true)}>
                <Icon name="trash" width={16} /> Excluir aula
              </button>
            )}
          </div>
        )}
      </div>
    </li>
  );
}

function RenameFields({ s, onDone }: { s: Section; onDone: () => void }) {
  const [number, setNumber] = useState(s.number);
  const [title, setTitle] = useState(s.title);
  const save = async () => {
    await updateSection(s.id, { number: number.trim() || s.number, title: title.trim() || s.title });
    onDone();
  };
  return (
    <>
      <input className="text-input" value={number} onChange={(e) => setNumber(e.target.value)} aria-label="Número" />
      <input
        className="text-input"
        autoFocus
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') save();
          if (e.key === 'Escape') onDone();
        }}
        onBlur={save}
        aria-label="Título"
      />
    </>
  );
}

const NUM_COLORS = ['var(--lavanda)', 'var(--rosa)', 'var(--azul)', 'var(--verde)', 'var(--lilas)', 'var(--amarelo)'];
export const numberColor = (i: number) => NUM_COLORS[i % NUM_COLORS.length];

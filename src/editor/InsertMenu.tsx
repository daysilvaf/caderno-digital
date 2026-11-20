import { useLiveQuery } from 'dexie-react-hooks';
import { useRef, useState } from 'react';
import { assetUrl, pickFiles, saveFile, saveImage } from '../assets';
import { useOutside } from '../components/useOutside';
import { db } from '../db';
import { Icon } from '../icons';
import { STICKER_CATEGORIES, STICKERS, stickerUrl } from '../stickers';
import type { EditorApi } from './Editor';

type Panel = null | 'menu' | 'stickers' | 'link';

export function InsertMenu({ api, onImportPdf }: { api: React.RefObject<EditorApi | null>; onImportPdf: (files: File[]) => void }) {
  const [panel, setPanel] = useState<Panel>(null);
  const ref = useRef<HTMLDivElement>(null);
  useOutside(ref, panel !== null, () => setPanel(null));

  return (
    <div className="row-menu" ref={ref}>
      <button className={`btn ${panel ? 'active-btn' : ''}`} onClick={() => setPanel(panel ? null : 'menu')} title="Inserir imagem, sticker, link, documento ou PDF">
        <Icon name="plus" width={16} /> <span className="hide-sm">Inserir</span>
      </button>
      {panel === 'menu' && (
        <div className="menu" style={{ left: 0, right: 'auto', minWidth: 220 }}>
          <button
            onClick={async () => {
              setPanel(null);
              const files = await pickFiles('image/*');
              if (files.length) api.current?.insertImageFiles(files);
            }}
          >
            <Icon name="image" width={16} /> Imagem do computador
          </button>
          <button onClick={() => setPanel('stickers')}>
            <Icon name="star" width={16} /> Sticker
          </button>
          <button onClick={() => setPanel('link')}>
            <PathIcon d="M10 14a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1M14 10a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1" /> Link
          </button>
          <button
            onClick={async () => {
              setPanel(null);
              const files = await pickFiles('*/*');
              for (const f of files) {
                const a = await saveFile(f);
                api.current?.insertDocument(a);
              }
            }}
          >
            <PathIcon d="M21 11l-9 9a5 5 0 0 1-7-7l9-9a3.5 3.5 0 0 1 5 5l-9 9a2 2 0 0 1-3-3l8-8" /> Documento anexo
          </button>
          <hr />
          <button
            onClick={async () => {
              setPanel(null);
              const files = await pickFiles('application/pdf,.pdf');
              if (files.length) onImportPdf(files);
            }}
          >
            <Icon name="paper" width={16} /> Importar PDF como páginas
          </button>
          <span className="hint" style={{ padding: '4px 10px' }}>
            Dica: também dá para colar (Ctrl V) ou arrastar imagens e arquivos para a folha.
          </span>
        </div>
      )}
      {panel === 'stickers' && <StickerPanel api={api} onClose={() => setPanel(null)} />}
      {panel === 'link' && <LinkForm api={api} onClose={() => setPanel(null)} />}
    </div>
  );
}

function StickerPanel({ api, onClose }: { api: React.RefObject<EditorApi | null>; onClose: () => void }) {
  const [cat, setCat] = useState<string>('Todos');
  const mine = useLiveQuery(() => db.assets.where('kind').equals('sticker').reverse().sortBy('createdAt'));
  const cats = ['Todos', 'Meus stickers', ...STICKER_CATEGORIES];
  const list = cat === 'Todos' ? STICKERS : STICKERS.filter((s) => s.category === cat);

  return (
    <div className="popover sticker-panel" style={{ left: 0 }}>
      <div className="sticker-cats">
        {cats.map((c) => (
          <button key={c} className={`chip-filter ${cat === c ? 'on' : ''}`} onClick={() => setCat(c)}>
            {c}
          </button>
        ))}
      </div>
      <div className="sticker-grid">
        {cat === 'Meus stickers' ? (
          <>
            <button
              className="sticker-add"
              onClick={async () => {
                const files = await pickFiles('image/*');
                for (const f of files) await saveImage(f, f.name, 'sticker');
              }}
              title="Adicionar sticker (PNG com fundo transparente fica melhor)"
            >
              <Icon name="plus" width={22} />
              <span>Adicionar</span>
            </button>
            {mine?.map((a) => (
              <button key={a.id} title={a.name} onClick={() => (api.current?.insertSticker(a.id, a.w, a.h), onClose())}>
                <img src={assetUrl(a)} alt={a.name} />
              </button>
            ))}
          </>
        ) : (
          list.map((s) => (
            <button key={s.id} title={s.name} onClick={() => (api.current?.insertSticker(s.id), onClose())}>
              <img src={stickerUrl(s.id)!} alt={s.name} />
            </button>
          ))
        )}
      </div>
    </div>
  );
}

function LinkForm({ api, onClose }: { api: React.RefObject<EditorApi | null>; onClose: () => void }) {
  const [url, setUrl] = useState('');
  const [label, setLabel] = useState('');
  return (
    <form
      className="popover"
      style={{ left: 0 }}
      onSubmit={(e) => {
        e.preventDefault();
        let u = url.trim();
        if (!u) return;
        if (!/^[a-z]+:\/\//i.test(u)) u = 'https://' + u;
        api.current?.insertLink(u, label.trim() || u.replace(/^https?:\/\//, ''));
        onClose();
      }}
    >
      <h4>Inserir link</h4>
      <input className="text-input" autoFocus placeholder="https://…" value={url} onChange={(e) => setUrl(e.target.value)} style={{ width: '100%', marginBottom: 8 }} id="link-url" />
      <input className="text-input" placeholder="Texto (opcional)" value={label} onChange={(e) => setLabel(e.target.value)} style={{ width: '100%', marginBottom: 10 }} id="link-label" />
      <button className="btn primary" type="submit" style={{ width: '100%', justifyContent: 'center' }}>
        Inserir
      </button>
      <p className="hint" style={{ whiteSpace: 'normal', margin: '8px 0 0' }}>
        Para abrir: duplo clique no link, ou clique com a ferramenta mão.
      </p>
    </form>
  );
}

function PathIcon({ d }: { d: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" width={16} height={16} aria-hidden>
      <path d={d} />
    </svg>
  );
}

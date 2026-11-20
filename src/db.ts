import Dexie, { type Table } from 'dexie';
import { nanoid } from 'nanoid';
import type { Asset, Notebook, Page, PageTemplate, Section } from './types';
import { PAGE_SIZES } from './types';

class CadernoDB extends Dexie {
  notebooks!: Table<Notebook, string>;
  sections!: Table<Section, string>;
  pages!: Table<Page, string>;
  assets!: Table<Asset, string>;

  constructor() {
    super('caderno-digital');
    this.version(1).stores({
      notebooks: 'id',
      sections: 'id, notebookId, order, favorite, status, *tags',
      pages: 'id, sectionId, [sectionId+order], favorite, bookmarked, *tags, updatedAt',
      assets: 'id, createdAt',
    });
    this.version(2)
      .stores({ assets: 'id, createdAt, kind, parentId' })
      .upgrade((tx) =>
        tx
          .table('assets')
          .toCollection()
          .modify((a: { kind?: string; mime?: string }) => {
            a.kind ??= a.mime?.startsWith('image/') ? 'imagem' : a.mime === 'application/pdf' ? 'pdf' : 'documento';
          }),
      );
  }
}

export const db = new CadernoDB();

export const NOTEBOOK_ID = 'qpn';

const AULAS: Array<[string, string]> = [
  ['01', 'PIC e Fitoterapia no SUS'],
  ['02', 'PNPIC'],
  ['03', 'Desenvolvimento de Medicamentos Fitoterápicos'],
  ['04', 'Biossíntese de Metabólitos'],
  ['05', 'Polissacarídeos'],
  ['06', 'Compostos Fenólicos'],
  ['06 Comp.', 'Óleos Voláteis'],
  ['07', 'Cumarinas e Lignanas'],
  ['07 Comp.', 'Flavonoides'],
  ['09', 'Taninos'],
  ['10', 'Saponinas'],
  ['11', 'Quinonas'],
  ['12', 'Alcaloides'],
  ['QO-1', 'Química Orgânica 1'],
  ['QO-2', 'Química Orgânica 2'],
];

export const DEFAULT_TEMPLATE: PageTemplate = { color: 'preto', pattern: 'quadriculado' };

export function newPage(sectionId: string, order: number, template: PageTemplate, title = ''): Page {
  const now = Date.now();
  return {
    id: nanoid(),
    sectionId,
    order,
    title,
    template: { ...template },
    width: PAGE_SIZES.a4.w,
    height: PAGE_SIZES.a4.h,
    favorite: 0,
    bookmarked: 0,
    tags: [],
    elements: [],
    createdAt: now,
    updatedAt: now,
  };
}

/** Marca a transação atual como "não é edição da usuária" (semente ou vinda da nuvem). */
export function tagTransaction(tag: '__seed' | '__remote') {
  const tx = Dexie.currentTransaction as unknown as Record<string, boolean> | null;
  if (tx) tx[tag] = true;
}

/**
 * Cria o caderno da matéria na primeira abertura.
 * Ids fixos e data 0: assim dois aparelhos criam o mesmo caderno inicial,
 * e qualquer edição real (de qualquer aparelho) vale mais que ele na sincronização.
 */
export async function ensureSeed() {
  await db.transaction('rw', db.notebooks, db.sections, db.pages, async () => {
    if (await db.notebooks.get(NOTEBOOK_ID)) return;
    tagTransaction('__seed');
    await db.notebooks.add({
      id: NOTEBOOK_ID,
      title: 'Química dos Produtos Naturais',
      subtitle: 'Caderno Digital',
      coverColor: '#b9a7e8',
      defaultTemplate: DEFAULT_TEMPLATE,
      createdAt: 0,
      updatedAt: 0,
    });
    for (let i = 0; i < AULAS.length; i++) {
      const [number, title] = AULAS[i];
      const id = 'aula-' + number.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-$/, '');
      await db.sections.add({
        id,
        notebookId: NOTEBOOK_ID,
        number,
        title,
        order: i,
        status: 'nao-iniciada',
        favorite: 0,
        tags: [],
        updatedAt: 0,
      });
      await db.pages.add({ ...newPage(id, 0, DEFAULT_TEMPLATE), id: `${id}-p1`, createdAt: 0, updatedAt: 0 });
    }
  });
}

// ---------- Aulas ----------

export async function addSection(number: string, title: string) {
  const count = await db.sections.where('notebookId').equals(NOTEBOOK_ID).count();
  const nb = await db.notebooks.get(NOTEBOOK_ID);
  const id = nanoid();
  await db.transaction('rw', db.sections, db.pages, async () => {
    await db.sections.add({
      id,
      notebookId: NOTEBOOK_ID,
      number,
      title,
      order: count,
      status: 'nao-iniciada',
      favorite: 0,
      tags: [],
      updatedAt: Date.now(),
    });
    await db.pages.add(newPage(id, 0, nb?.defaultTemplate ?? DEFAULT_TEMPLATE));
  });
  return id;
}

export async function updateSection(id: string, changes: Partial<Section>) {
  await db.sections.update(id, { ...changes, updatedAt: Date.now() });
}

export async function deleteSection(id: string) {
  await db.transaction('rw', db.sections, db.pages, async () => {
    await db.pages.where('sectionId').equals(id).delete();
    await db.sections.delete(id);
    const rest = await db.sections.where('notebookId').equals(NOTEBOOK_ID).sortBy('order');
    await Promise.all(rest.map((s, i) => db.sections.update(s.id, { order: i })));
  });
}

/** Move um item da posição `from` para `to` e regrava a ordem. */
function moveInArray<T>(arr: T[], from: number, to: number) {
  const copy = arr.slice();
  const [item] = copy.splice(from, 1);
  copy.splice(to, 0, item);
  return copy;
}

export async function reorderSection(id: string, toIndex: number) {
  await db.transaction('rw', db.sections, async () => {
    const all = await db.sections.where('notebookId').equals(NOTEBOOK_ID).sortBy('order');
    const from = all.findIndex((s) => s.id === id);
    if (from < 0) return;
    const next = moveInArray(all, from, Math.max(0, Math.min(toIndex, all.length - 1)));
    await Promise.all(next.map((s, i) => db.sections.update(s.id, { order: i })));
  });
}

// ---------- Páginas ----------

export async function sectionPages(sectionId: string) {
  return db.pages.where('[sectionId+order]').between([sectionId, Dexie.minKey], [sectionId, Dexie.maxKey]).toArray();
}

export async function addPage(sectionId: string, afterIndex?: number, template?: PageTemplate) {
  return db.transaction('rw', db.pages, db.notebooks, async () => {
    const pages = await sectionPages(sectionId);
    const at = afterIndex === undefined ? pages.length : afterIndex + 1;
    const base = template ?? pages[Math.min(at, pages.length) - 1]?.template ?? (await db.notebooks.get(NOTEBOOK_ID))?.defaultTemplate ?? DEFAULT_TEMPLATE;
    const page = newPage(sectionId, at, base);
    const prev = pages[at - 1];
    if (prev) {
      page.width = prev.width;
      page.height = prev.height;
    }
    await Promise.all(pages.slice(at).map((p) => db.pages.update(p.id, { order: p.order + 1 })));
    await db.pages.add(page);
    return page.id;
  });
}

export async function duplicatePage(pageId: string) {
  return db.transaction('rw', db.pages, async () => {
    const src = await db.pages.get(pageId);
    if (!src) return;
    const pages = await sectionPages(src.sectionId);
    const at = src.order + 1;
    await Promise.all(pages.filter((p) => p.order >= at).map((p) => db.pages.update(p.id, { order: p.order + 1 })));
    const now = Date.now();
    const copy: Page = {
      ...structuredClone(src),
      id: nanoid(),
      order: at,
      title: src.title ? `${src.title} (cópia)` : '',
      createdAt: now,
      updatedAt: now,
    };
    await db.pages.add(copy);
    return copy.id;
  });
}

/** Exclui a página. Se for a única da aula, ela é substituída por uma em branco. */
export async function deletePage(pageId: string) {
  return db.transaction('rw', db.pages, async () => {
    const src = await db.pages.get(pageId);
    if (!src) return;
    await db.pages.delete(pageId);
    const rest = await sectionPages(src.sectionId);
    if (rest.length === 0) {
      await db.pages.add(newPage(src.sectionId, 0, src.template));
    } else {
      await Promise.all(rest.map((p, i) => db.pages.update(p.id, { order: i })));
    }
  });
}

export async function reorderPage(pageId: string, toIndex: number) {
  await db.transaction('rw', db.pages, async () => {
    const src = await db.pages.get(pageId);
    if (!src) return;
    const pages = await sectionPages(src.sectionId);
    const from = pages.findIndex((p) => p.id === pageId);
    const next = moveInArray(pages, from, Math.max(0, Math.min(toIndex, pages.length - 1)));
    await Promise.all(next.map((p, i) => db.pages.update(p.id, { order: i })));
  });
}

export async function updatePage(id: string, changes: Partial<Page>) {
  await db.pages.update(id, { ...changes, updatedAt: Date.now() });
}

export async function updateNotebook(changes: Partial<Notebook>) {
  await db.notebooks.update(NOTEBOOK_ID, { ...changes, updatedAt: Date.now() });
}

// Pede ao navegador para não apagar os dados quando faltar espaço.
export async function requestPersistence() {
  try {
    if (navigator.storage?.persist && !(await navigator.storage.persisted())) {
      await navigator.storage.persist();
    }
  } catch {
    /* sem suporte */
  }
}

import { nanoid } from 'nanoid';
import { preloadImages, saveImage } from './assets';
import { addPage, db, updatePage } from './db';
import type { El } from './editor/elements';
import type { PageTemplate } from './types';

/*
 * "Página pronta": um arquivo .caderno.json com uma página inteira (textos, setas,
 * caixas e as imagens embutidas). Ao importar, vira uma página nova e editável.
 */

export interface PagePack {
  formato: 'caderno-pagina';
  versao: 1;
  titulo: string;
  template: PageTemplate;
  width: number;
  height: number;
  elementos: El[];
  arquivos: { id: string; nome: string; mime: string; dados: string }[];
}

export function isPagePackFile(f: File) {
  return /\.caderno\.json$/i.test(f.name) || (/\.json$/i.test(f.name) && f.size > 0);
}

function base64ToBlob(b64: string, mime: string) {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

/** Cria uma página nova na aula com o conteúdo do arquivo. Devolve o id da página. */
export async function importPagePack(file: File, sectionId: string, afterPageId?: string): Promise<string> {
  let pack: PagePack;
  try {
    pack = JSON.parse(await file.text());
  } catch {
    throw new Error('Este arquivo não é uma página do caderno.');
  }
  if (pack?.formato !== 'caderno-pagina' || !Array.isArray(pack.elementos)) throw new Error('Este arquivo não é uma página do caderno.');

  const ids = new Map<string, string>();
  for (const a of pack.arquivos ?? []) {
    const saved = await saveImage(base64ToBlob(a.dados, a.mime), a.nome);
    ids.set(a.id, saved.id);
  }
  const elements = pack.elementos.map((el) => {
    const copy = { ...el, id: nanoid() } as El;
    if (copy.type === 'image' && ids.has(copy.assetId)) copy.assetId = ids.get(copy.assetId)!;
    return copy;
  });

  const after = afterPageId ? (await db.pages.get(afterPageId))?.order : undefined;
  const pageId = await addPage(sectionId, after, pack.template);
  await updatePage(pageId, { title: pack.titulo ?? '', elements, width: pack.width, height: pack.height });

  // Miniatura para a lista de páginas.
  const page = await db.pages.get(pageId);
  if (page) {
    await preloadImages(elements.flatMap((e) => (e.type === 'image' ? [e.assetId] : [])));
    await document.fonts?.ready;
    const { renderThumbnail } = await import('./editor/Editor');
    const thumbnail = renderThumbnail(page, elements);
    if (thumbnail) await updatePage(pageId, { thumbnail });
  }
  return pageId;
}

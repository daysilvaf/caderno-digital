import { nanoid } from 'nanoid';
import { db, sectionPages } from './db';
import type { Asset, Page } from './types';

/*
 * Importação de PDF: cada página do PDF vira uma imagem de fundo de uma página do caderno,
 * e por cima dela dá para escrever, destacar e desenhar normalmente.
 * O PDF original também fica guardado na biblioteca.
 */

const PAGE_W = 794; // largura lógica da página no caderno
const RENDER_SCALE = 2; // resolução da imagem gerada (nitidez ao dar zoom)

// pdf.js é carregado só quando for usado (é grande).
async function loadPdfJs() {
  const pdfjs = await import('pdfjs-dist');
  if (!pdfjs.GlobalWorkerOptions.workerPort) {
    const workerSrc = (await import('pdfjs-dist/build/pdf.worker.min.mjs?raw')).default;
    const url = URL.createObjectURL(new Blob([workerSrc], { type: 'text/javascript' }));
    pdfjs.GlobalWorkerOptions.workerPort = new Worker(url, { type: 'module' });
  }
  return pdfjs;
}

export interface PdfProgress {
  done: number;
  total: number;
}

export async function importPdf(file: File, sectionId: string, afterOrder: number | undefined, onProgress?: (p: PdfProgress) => void) {
  const pdfjs = await loadPdfJs();
  const data = new Uint8Array(await file.arrayBuffer());
  const doc = await pdfjs.getDocument({ data: data.slice() }).promise;
  const total = doc.numPages;

  const pdfAsset: Asset = {
    id: nanoid(),
    kind: 'pdf',
    name: file.name,
    mime: 'application/pdf',
    size: file.size,
    blob: file,
    sectionId,
    pageCount: total,
    createdAt: Date.now(),
  };
  await db.assets.add(pdfAsset);

  const existing = await sectionPages(sectionId);
  const insertAt = afterOrder === undefined ? existing.length : afterOrder + 1;
  const newPages: Page[] = [];

  for (let i = 1; i <= total; i++) {
    const pg = await doc.getPage(i);
    const vp1 = pg.getViewport({ scale: 1 });
    const height = Math.round((PAGE_W * vp1.height) / vp1.width);
    const vp = pg.getViewport({ scale: (PAGE_W * RENDER_SCALE) / vp1.width });
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(vp.width);
    canvas.height = Math.round(vp.height);
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    await pg.render({ canvasContext: ctx, viewport: vp }).promise;
    const blob = await new Promise<Blob>((r) => canvas.toBlob((b) => r(b!), 'image/jpeg', 0.88));

    // miniatura
    const t = document.createElement('canvas');
    t.width = 220;
    t.height = Math.round((220 * canvas.height) / canvas.width);
    t.getContext('2d')!.drawImage(canvas, 0, 0, t.width, t.height);

    const imgAsset: Asset = {
      id: nanoid(),
      kind: 'pagina-pdf',
      name: `${file.name} · p. ${i}`,
      mime: 'image/jpeg',
      size: blob.size,
      blob,
      w: canvas.width,
      h: canvas.height,
      parentId: pdfAsset.id,
      createdAt: Date.now(),
    };
    await db.assets.add(imgAsset);

    const now = Date.now();
    newPages.push({
      id: nanoid(),
      sectionId,
      order: insertAt + i - 1,
      title: total > 1 ? `${file.name.replace(/\.pdf$/i, '')} · ${i}` : file.name.replace(/\.pdf$/i, ''),
      template: { color: 'branco', pattern: 'liso' },
      width: PAGE_W,
      height,
      favorite: 0,
      bookmarked: 0,
      tags: ['pdf'],
      elements: [],
      background: { assetId: imgAsset.id },
      thumbnail: t.toDataURL('image/jpeg', 0.8),
      createdAt: now,
      updatedAt: now,
    });
    onProgress?.({ done: i, total });
    pg.cleanup();
  }
  await doc.destroy();

  await db.transaction('rw', db.pages, async () => {
    const pages = await sectionPages(sectionId);
    await Promise.all(pages.filter((p) => p.order >= insertAt).map((p) => db.pages.update(p.id, { order: p.order + total })));
    await db.pages.bulkAdd(newPages);
  });
  return { firstPageId: newPages[0]?.id, pdfId: pdfAsset.id };
}

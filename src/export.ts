import { preloadImages, getImage } from './assets';
import { db, NOTEBOOK_ID, sectionPages } from './db';
import { drawElements, type El } from './editor/elements';
import { drawPaper } from './paper';
import type { Page, Section } from './types';

/*
 * Exportação: cada página é desenhada num canvas (papel + PDF de fundo + escrita)
 * e depois vira PDF, PNG ou vai para a impressão.
 */

const EXPORT_SCALE = 2; // nitidez (2 = o dobro da resolução da tela)

function imageIdsOf(p: Page): string[] {
  const ids = (p.elements as El[]).filter((e) => e.type === 'image').map((e) => (e as Extract<El, { type: 'image' }>).assetId);
  if (p.background) ids.push(p.background.assetId);
  return ids;
}

export async function renderPageCanvas(p: Page, scale = EXPORT_SCALE): Promise<HTMLCanvasElement> {
  await document.fonts?.ready;
  await preloadImages(imageIdsOf(p));
  const c = document.createElement('canvas');
  c.width = Math.round(p.width * scale);
  c.height = Math.round(p.height * scale);
  const ctx = c.getContext('2d')!;
  ctx.scale(scale, scale);
  drawPaper(ctx, p.template, p.width, p.height);
  if (p.background) {
    const bg = getImage(p.background.assetId);
    if (bg) ctx.drawImage(bg, 0, 0, p.width, p.height);
  }
  drawElements(ctx, p.elements as El[]);
  return c;
}

export function downloadBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

export function safeName(s: string) {
  return (
    s
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^\w\- ]+/g, '')
      .trim()
      .replace(/\s+/g, '-')
      .slice(0, 60) || 'caderno'
  );
}

export type Progress = (done: number, total: number) => void;

export async function exportPdf(pages: Page[], fileName: string, onProgress?: Progress) {
  const { jsPDF } = await import('jspdf');
  let doc: InstanceType<typeof jsPDF> | null = null;
  for (let i = 0; i < pages.length; i++) {
    const p = pages[i];
    // 1 px da página = 0,75 pt (A4 de 794 px ≈ 595 pt)
    const w = p.width * 0.75;
    const h = p.height * 0.75;
    const orientation = w > h ? 'landscape' : 'portrait';
    if (!doc) doc = new jsPDF({ unit: 'pt', format: [w, h], orientation, compress: true });
    else doc.addPage([w, h], orientation);
    const c = await renderPageCanvas(p);
    doc.addImage(c.toDataURL('image/jpeg', 0.9), 'JPEG', 0, 0, w, h, undefined, 'FAST');
    onProgress?.(i + 1, pages.length);
  }
  if (doc) downloadBlob(doc.output('blob'), fileName.endsWith('.pdf') ? fileName : fileName + '.pdf');
}

export async function exportPngs(pages: Page[], baseName: string, onProgress?: Progress) {
  if (pages.length === 1) {
    const c = await renderPageCanvas(pages[0]);
    const blob = await new Promise<Blob>((r) => c.toBlob((b) => r(b!), 'image/png'));
    downloadBlob(blob, `${baseName}.png`);
    onProgress?.(1, 1);
    return;
  }
  const JSZip = (await import('jszip')).default;
  const zip = new JSZip();
  for (let i = 0; i < pages.length; i++) {
    const c = await renderPageCanvas(pages[i]);
    const blob = await new Promise<Blob>((r) => c.toBlob((b) => r(b!), 'image/png'));
    zip.file(`${String(i + 1).padStart(3, '0')}.png`, blob);
    onProgress?.(i + 1, pages.length);
  }
  downloadBlob(await zip.generateAsync({ type: 'blob' }), `${baseName}-imagens.zip`);
}

/** Monta as páginas numa área só de impressão e abre a janela de imprimir do navegador. */
export async function printPages(pages: Page[], onProgress?: Progress) {
  const holder = document.createElement('div');
  holder.id = 'print-area';
  for (let i = 0; i < pages.length; i++) {
    const c = await renderPageCanvas(pages[i], 1.5);
    const img = document.createElement('img');
    img.src = c.toDataURL('image/jpeg', 0.9);
    holder.appendChild(img);
    onProgress?.(i + 1, pages.length);
  }
  document.body.appendChild(holder);
  await Promise.all([...holder.querySelectorAll('img')].map((im) => im.decode().catch(() => {})));
  const cleanup = () => {
    holder.remove();
    window.removeEventListener('afterprint', cleanup);
  };
  window.addEventListener('afterprint', cleanup);
  window.print();
  setTimeout(cleanup, 60_000);
}

/** Todas as páginas do caderno, na ordem do índice. */
export async function allPagesInOrder(): Promise<{ section: Section; pages: Page[] }[]> {
  const sections = await db.sections.where('notebookId').equals(NOTEBOOK_ID).sortBy('order');
  return Promise.all(sections.map(async (section) => ({ section, pages: await sectionPages(section.id) })));
}

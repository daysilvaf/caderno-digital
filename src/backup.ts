import { db } from './db';
import { downloadBlob } from './export';
import type { Asset } from './types';

/*
 * Backup completo: um arquivo .zip com os dados do caderno (data.json)
 * e todos os arquivos (PDFs, imagens, documentos, stickers).
 */

interface BackupData {
  app: 'caderno-digital';
  version: 1;
  createdAt: number;
  notebooks: unknown[];
  sections: unknown[];
  pages: unknown[];
  assets: Omit<Asset, 'blob'>[];
}

export async function createBackup(onProgress?: (msg: string) => void) {
  const JSZip = (await import('jszip')).default;
  const zip = new JSZip();
  const [notebooks, sections, pages, assets] = await Promise.all([db.notebooks.toArray(), db.sections.toArray(), db.pages.toArray(), db.assets.toArray()]);
  const data: BackupData = {
    app: 'caderno-digital',
    version: 1,
    createdAt: Date.now(),
    notebooks,
    sections,
    pages,
    assets: assets.map(({ blob: _blob, ...meta }) => meta),
  };
  zip.file('data.json', JSON.stringify(data));
  const folder = zip.folder('arquivos')!;
  for (const a of assets) folder.file(a.id, a.blob);
  onProgress?.('Compactando…');
  const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 4 } });
  const d = new Date();
  const stamp = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  downloadBlob(blob, `backup-caderno-qpn-${stamp}.zip`);
  return { pages: pages.length, files: assets.length, size: blob.size };
}

/** Substitui todo o conteúdo do caderno pelo do backup. */
export async function restoreBackup(file: File) {
  const JSZip = (await import('jszip')).default;
  const zip = await JSZip.loadAsync(file);
  const json = await zip.file('data.json')?.async('string');
  if (!json) throw new Error('Arquivo de backup inválido: falta o data.json.');
  const data = JSON.parse(json) as BackupData;
  if (data.app !== 'caderno-digital') throw new Error('Este arquivo não é um backup do caderno.');

  const assets: Asset[] = [];
  for (const meta of data.assets) {
    const f = zip.file(`arquivos/${meta.id}`);
    if (!f) continue;
    const buf = await f.async('arraybuffer');
    assets.push({ ...meta, blob: new Blob([buf], { type: meta.mime }) } as Asset);
  }

  await db.transaction('rw', [db.notebooks, db.sections, db.pages, db.assets], async () => {
    await Promise.all([db.notebooks.clear(), db.sections.clear(), db.pages.clear(), db.assets.clear()]);
    await db.notebooks.bulkAdd(data.notebooks as never[]);
    await db.sections.bulkAdd(data.sections as never[]);
    await db.pages.bulkAdd(data.pages as never[]);
    await db.assets.bulkAdd(assets);
  });
  return { pages: data.pages.length, files: assets.length };
}

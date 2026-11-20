import { nanoid } from 'nanoid';
import { db } from './db';
import { stickerUrl } from './stickers';
import type { Asset, AssetKind } from './types';

/*
 * Arquivos (imagens, PDFs, documentos, stickers próprios) ficam no IndexedDB como Blob.
 * Para desenhar no canvas, as imagens são carregadas uma vez e guardadas em memória.
 */

const images = new Map<string, HTMLImageElement | 'loading' | 'error'>();
const listeners = new Set<() => void>();
const objectUrls = new Map<string, string>();

export function onAssetLoaded(fn: () => void) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

/** Retorna a imagem pronta para desenhar, ou null enquanto carrega (avisa quando terminar). */
export function getImage(assetId: string): HTMLImageElement | null {
  const cur = images.get(assetId);
  if (cur instanceof HTMLImageElement) return cur;
  if (cur) return null;
  images.set(assetId, 'loading');
  (async () => {
    let url = stickerUrl(assetId);
    if (!url) {
      const a = await db.assets.get(assetId);
      if (!a) {
        images.set(assetId, 'error');
        return;
      }
      url = assetUrl(a);
    }
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => {
      images.set(assetId, img);
      listeners.forEach((l) => l());
    };
    img.onerror = () => images.set(assetId, 'error');
    img.src = url;
  })();
  return null;
}

/** Carrega várias imagens e espera (usado em miniaturas e exportação). */
export async function preloadImages(ids: string[]) {
  await Promise.all(
    ids.map(
      (id) =>
        new Promise<void>((resolve) => {
          if (getImage(id)) return resolve();
          const off = onAssetLoaded(() => {
            const s = images.get(id);
            if (s instanceof HTMLImageElement || s === 'error') {
              off();
              resolve();
            }
          });
          setTimeout(() => {
            off();
            resolve();
          }, 4000);
        }),
    ),
  );
}

export function assetUrl(a: Asset) {
  let u = objectUrls.get(a.id);
  if (!u) {
    u = URL.createObjectURL(a.blob);
    objectUrls.set(a.id, u);
  }
  return u;
}

export function kindOf(file: File): AssetKind {
  if (file.type.startsWith('image/')) return 'imagem';
  if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) return 'pdf';
  return 'documento';
}

function loadImg(blob: Blob): Promise<HTMLImageElement> {
  return new Promise((res, rej) => {
    const img = new Image();
    img.onload = () => res(img);
    img.onerror = rej;
    img.src = URL.createObjectURL(blob);
  });
}

const MAX_SIDE = 2400;

/** Salva uma imagem (reduzindo fotos muito grandes) e devolve o asset. */
export async function saveImage(file: Blob, name: string, kind: AssetKind = 'imagem'): Promise<Asset> {
  let blob = file;
  let img = await loadImg(file);
  let w = img.naturalWidth || 300;
  let h = img.naturalHeight || 300;
  if (Math.max(w, h) > MAX_SIDE && file.type !== 'image/svg+xml') {
    const s = MAX_SIDE / Math.max(w, h);
    const c = document.createElement('canvas');
    c.width = Math.round(w * s);
    c.height = Math.round(h * s);
    c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
    const type = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
    blob = await new Promise<Blob>((r) => c.toBlob((b) => r(b ?? file), type, 0.9));
    w = c.width;
    h = c.height;
    img = await loadImg(blob);
  }
  const asset: Asset = { id: nanoid(), kind, name, mime: blob.type || file.type, size: blob.size, blob, w, h, createdAt: Date.now() };
  await db.assets.add(asset);
  images.set(asset.id, img);
  return asset;
}

export async function saveFile(file: File, kind: AssetKind = kindOf(file)): Promise<Asset> {
  const asset: Asset = { id: nanoid(), kind, name: file.name, mime: file.type || 'application/octet-stream', size: file.size, blob: file, createdAt: Date.now() };
  await db.assets.add(asset);
  return asset;
}

/** Abre um arquivo guardado numa nova aba (ou baixa, se o navegador não souber exibir). */
export async function openAsset(id: string) {
  const a = await db.assets.get(id);
  if (!a) return false;
  const url = assetUrl(a);
  const w = window.open(url, '_blank', 'noopener');
  if (!w) {
    const link = document.createElement('a');
    link.href = url;
    link.download = a.name;
    link.click();
  }
  return true;
}

export function formatBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

export function pickFiles(accept: string, multiple = true): Promise<File[]> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;
    input.multiple = multiple;
    input.onchange = () => resolve(Array.from(input.files ?? []));
    input.click();
  });
}

/*
 * "Efeito caderno": tira o fundo liso de uma imagem (branco, creme, cinza...)
 * para que só o desenho e o texto fiquem por cima da folha, como se tivessem
 * sido feitos direto nela. Funciona sem internet e sem custo.
 */

function loadImg(blob: Blob): Promise<HTMLImageElement> {
  return new Promise((res, rej) => {
    const img = new Image();
    img.onload = () => res(img);
    img.onerror = rej;
    img.src = URL.createObjectURL(blob);
  });
}

/** Cor do fundo: mediana dos pixels da borda da imagem. */
function borderColor(d: Uint8ClampedArray, w: number, h: number): [number, number, number] {
  const rs: number[] = [];
  const gs: number[] = [];
  const bs: number[] = [];
  const take = (x: number, y: number) => {
    const i = (y * w + x) * 4;
    if (d[i + 3] < 200) return;
    rs.push(d[i]);
    gs.push(d[i + 1]);
    bs.push(d[i + 2]);
  };
  const step = Math.max(1, Math.floor(Math.max(w, h) / 400));
  for (let x = 0; x < w; x += step) {
    take(x, 0);
    take(x, h - 1);
  }
  for (let y = 0; y < h; y += step) {
    take(0, y);
    take(w - 1, y);
  }
  const med = (a: number[]) => (a.length ? a.sort((p, q) => p - q)[a.length >> 1] : 255);
  return [med(rs), med(gs), med(bs)];
}

/**
 * Devolve uma cópia em PNG com o fundo transparente.
 * `region` (em frações 0–1) recorta só um pedaço da imagem.
 */
export async function inkify(src: Blob | HTMLImageElement, opts: { region?: { x: number; y: number; w: number; h: number }; maxSide?: number; grayTo?: string } = {}): Promise<Blob> {
  const { region = { x: 0, y: 0, w: 1, h: 1 }, maxSide = 2400, grayTo } = opts;
  // Em papel escuro, a tinta preta/cinza vira a cor de tinta do papel (senão some na folha).
  const gray = grayTo ? [1, 3, 5].map((i) => parseInt(grayTo.slice(i, i + 2), 16)) : null;
  const img = src instanceof HTMLImageElement ? src : await loadImg(src);
  const nw = img.naturalWidth;
  const nh = img.naturalHeight;
  const sw = region.w * nw;
  const sh = region.h * nh;
  const s = Math.min(1, maxSide / Math.max(sw, sh));
  const w = Math.max(1, Math.round(sw * s));
  const h = Math.max(1, Math.round(sh * s));
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d', { willReadFrequently: true })!;
  g.drawImage(img, region.x * nw, region.y * nh, sw, sh, 0, 0, w, h);
  const data = g.getImageData(0, 0, w, h);
  const d = data.data;
  const [br, bgc, bb] = borderColor(d, w, h);

  const LOW = 22; // até aqui é fundo
  const HIGH = 90; // daqui para cima é tinta
  for (let i = 0; i < d.length; i += 4) {
    const r = d[i];
    const gr = d[i + 1];
    const b = d[i + 2];
    const dist = Math.sqrt((r - br) ** 2 + (gr - bgc) ** 2 + (b - bb) ** 2);
    let a = (dist - LOW) / (HIGH - LOW);
    a = a <= 0 ? 0 : a >= 1 ? 1 : a * a * (3 - 2 * a);
    if (a === 0) {
      d[i + 3] = 0;
      continue;
    }
    // Remove o "halo" do fundo nas bordas da tinta.
    const un = (v: number, bgv: number) => Math.max(0, Math.min(255, (v - bgv * (1 - a)) / a));
    let nr = un(r, br);
    let ng = un(gr, bgc);
    let nb = un(b, bb);
    if (gray && Math.max(nr, ng, nb) - Math.min(nr, ng, nb) < 48 && nr + ng + nb < 420) {
      [nr, ng, nb] = gray;
    }
    d[i] = nr;
    d[i + 1] = ng;
    d[i + 2] = nb;
    d[i + 3] = Math.round(d[i + 3] * a);
  }
  g.putImageData(data, 0, 0);
  return new Promise<Blob>((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error('Não consegui gerar a imagem.'))), 'image/png'));
}

/** Recorta (sem tirar o fundo) e devolve um JPEG/PNG para mandar à IA. */
export async function cropForAi(img: HTMLImageElement, region: { x: number; y: number; w: number; h: number }, maxSide = 1600) {
  const nw = img.naturalWidth;
  const nh = img.naturalHeight;
  const sw = region.w * nw;
  const sh = region.h * nh;
  const s = Math.min(1, maxSide / Math.max(sw, sh));
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(sw * s));
  c.height = Math.max(1, Math.round(sh * s));
  const g = c.getContext('2d')!;
  g.fillStyle = '#fff';
  g.fillRect(0, 0, c.width, c.height);
  g.drawImage(img, region.x * nw, region.y * nh, sw, sh, 0, 0, c.width, c.height);
  const url = c.toDataURL('image/jpeg', 0.9);
  return { base64: url.slice(url.indexOf(',') + 1), w: c.width, h: c.height };
}

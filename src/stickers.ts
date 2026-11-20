/**
 * Biblioteca de stickers embutida (SVG). Cada sticker vira um elemento de imagem na página.
 * Ids começam com "stk:" para diferenciar dos arquivos enviados pelo usuário.
 */

const O = '#2a2340'; // contorno
const L = '#b9a7e8'; // lavanda
const Li = '#d7b8f3'; // lilás
const R = '#f4b8cf'; // rosa
const A = '#a9cdf2'; // azul
const V = '#b4e3c4'; // verde
const Am = '#f5e1a4'; // amarelo
const W = '#ffffff';

function svg(w: number, h: number, body: string) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" fill="none" stroke="${O}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;
}

const leaf = (fill: string) =>
  svg(100, 120, `<path d="M50 110 V60" /><path d="M50 100 C10 90 8 40 50 8 C92 40 90 90 50 100 Z" fill="${fill}"/><path d="M50 30 V95 M50 55 L32 42 M50 70 L68 56 M50 82 L35 72" stroke-width="2.4"/>`);

const benzene = (fill: string, label = '') =>
  svg(
    120,
    120,
    `<path d="M60 12 L101 36 V84 L60 108 L19 84 V36 Z" fill="${fill}"/><circle cx="60" cy="60" r="24" stroke-width="2.6"/>${
      label ? `<text x="60" y="66" text-anchor="middle" font-family="Arial, sans-serif" font-size="16" font-weight="700" fill="${O}" stroke="none">${label}</text>` : ''
    }`,
  );

const note = (fill: string, text: string) =>
  svg(
    150,
    120,
    `<path d="M8 10 H142 V96 L118 112 H8 Z" fill="${fill}"/><path d="M142 96 H118 V112" fill="${W}" fill-opacity=".5"/><path d="M60 4 h30 v14 h-30z" fill="${W}" fill-opacity=".7" stroke-width="2"/><text x="75" y="64" text-anchor="middle" font-family="'Segoe Print','Comic Sans MS',cursive" font-size="20" font-weight="700" fill="${O}" stroke="none">${text}</text>`,
  );

const label = (fill: string, text: string) =>
  svg(
    170,
    60,
    `<path d="M30 6 H162 V54 H30 L6 30 Z" fill="${fill}"/><circle cx="30" cy="30" r="5" fill="${W}"/><text x="98" y="38" text-anchor="middle" font-family="Arial, sans-serif" font-size="20" font-weight="700" fill="${O}" stroke="none" letter-spacing="1">${text}</text>`,
  );

const star = (fill: string) =>
  svg(110, 110, `<path d="M55 6 L68 40 L104 42 L76 64 L86 100 L55 80 L24 100 L34 64 L6 42 L42 40 Z" fill="${fill}"/>`);

const sparkle = (fill: string) => svg(100, 100, `<path d="M50 4 C54 38 62 46 96 50 C62 54 54 62 50 96 C46 62 38 54 4 50 C38 46 46 38 50 4 Z" fill="${fill}"/>`);

export interface StickerDef {
  id: string;
  name: string;
  category: string;
  svg: string;
}

const RAW: Array<[string, string, string]> = [
  // Plantas
  ['planta-vaso', 'Planta no vaso', svg(110, 130, `<path d="M30 80 H80 L72 124 H38 Z" fill="${R}"/><path d="M26 74 H84 V86 H26 Z" fill="${R}"/><path d="M55 74 V40"/><path d="M55 50 C30 50 22 30 28 14 C46 16 56 30 55 50Z" fill="${V}"/><path d="M55 44 C78 44 88 26 82 8 C64 10 54 24 55 44Z" fill="${V}"/>`)],
  ['ramo', 'Ramo', svg(140, 120, `<path d="M10 110 C50 80 90 50 130 10"/><path d="M40 86 C20 70 22 50 34 42 C48 54 50 72 40 86Z" fill="${V}"/><path d="M62 68 C78 50 98 52 104 62 C92 76 74 78 62 68Z" fill="${V}"/><path d="M84 46 C70 30 74 12 86 6 C96 20 96 36 84 46Z" fill="${V}"/><path d="M28 98 C44 84 62 88 66 96 C52 108 38 108 28 98Z" fill="${V}"/>`)],
  ['erva', 'Erva medicinal', svg(120, 130, `<path d="M60 126 V30 M60 90 L36 60 M60 70 L86 44 M60 110 L84 86"/><circle cx="60" cy="24" r="14" fill="${Am}"/><path d="M36 60 C20 56 16 40 22 30 C36 36 40 50 36 60Z" fill="${V}"/><path d="M86 44 C100 38 106 24 100 14 C86 20 82 34 86 44Z" fill="${V}"/><path d="M84 86 C100 84 108 70 104 60 C90 62 82 74 84 86Z" fill="${V}"/>`)],
  ['cacto', 'Cacto', svg(110, 130, `<path d="M40 120 V40 C40 20 70 20 70 40 V120Z" fill="${V}"/><path d="M40 80 H26 C18 80 16 72 16 66 V52 C16 44 28 44 28 52 V66 H40" fill="${V}"/><path d="M70 70 H84 C92 70 94 62 94 56 V44 C94 36 82 36 82 44 V56 H70" fill="${V}"/><path d="M30 120 H80 V128 H30Z" fill="${R}"/><circle cx="55" cy="24" r="6" fill="${R}"/>`)],
  // Folhas
  ['folha-verde', 'Folha verde', leaf(V)],
  ['folha-lilas', 'Folha lilás', leaf(Li)],
  ['folha-ginkgo', 'Ginkgo', svg(120, 120, `<path d="M60 116 V64"/><path d="M60 64 C26 64 8 40 10 14 C30 8 44 20 56 30 C58 22 62 22 64 30 C76 20 90 8 110 14 C112 40 94 64 60 64Z" fill="${Am}"/><path d="M60 62 L30 24 M60 62 L46 18 M60 62 L74 18 M60 62 L90 24" stroke-width="2"/>`)],
  ['trevo', 'Trevo', svg(110, 120, `<path d="M55 60 V114"/><circle cx="36" cy="42" r="18" fill="${V}"/><circle cx="74" cy="42" r="18" fill="${V}"/><circle cx="55" cy="22" r="18" fill="${V}"/><circle cx="55" cy="46" r="4" fill="${O}"/>`)],
  // Flores
  ['flor-rosa', 'Flor rosa', svg(120, 120, `${[0, 72, 144, 216, 288].map((a) => `<ellipse cx="60" cy="32" rx="16" ry="26" fill="${R}" transform="rotate(${a} 60 60)"/>`).join('')}<circle cx="60" cy="60" r="14" fill="${Am}"/>`)],
  ['margarida', 'Camomila', svg(120, 120, `${Array.from({ length: 10 }, (_, i) => `<ellipse cx="60" cy="26" rx="9" ry="22" fill="${W}" transform="rotate(${i * 36} 60 60)"/>`).join('')}<circle cx="60" cy="60" r="16" fill="${Am}"/>`)],
  ['lavanda', 'Lavanda', svg(80, 140, `<path d="M40 136 V40"/>${[0, 1, 2, 3, 4, 5].map((i) => `<ellipse cx="${i % 2 ? 48 : 32}" cy="${20 + i * 14}" rx="9" ry="7" fill="${L}"/>`).join('')}<path d="M40 100 C26 96 20 84 22 76 C34 80 40 90 40 100Z" fill="${V}"/>`)],
  ['tulipa', 'Flor lilás', svg(100, 140, `<path d="M50 136 V70"/><path d="M50 116 C30 112 22 96 24 86 C40 90 48 102 50 116Z" fill="${V}"/><path d="M22 30 L36 44 L50 20 L64 44 L78 30 V60 C78 76 66 84 50 84 C34 84 22 76 22 60Z" fill="${Li}"/>`)],
  // Moléculas
  ['benzeno', 'Benzeno', benzene(W)],
  ['benzeno-lilas', 'Anel aromático', benzene(Li)],
  ['fenol', 'Fenol', svg(130, 130, `<path d="M60 30 L96 51 V93 L60 114 L24 93 V51 Z" fill="${A}"/><circle cx="60" cy="72" r="20" stroke-width="2.6"/><path d="M60 30 V12"/><text x="74" y="16" font-family="Arial, sans-serif" font-size="16" font-weight="700" fill="${O}" stroke="none">OH</text>`)],
  ['molecula', 'Molécula', svg(130, 110, `<path d="M30 70 L65 40 L100 70 M65 40 V12"/><circle cx="30" cy="70" r="16" fill="${R}"/><circle cx="100" cy="70" r="16" fill="${A}"/><circle cx="65" cy="40" r="20" fill="${L}"/><circle cx="65" cy="12" r="9" fill="${V}"/>`)],
  ['atomo', 'Átomo', svg(120, 120, `<ellipse cx="60" cy="60" rx="52" ry="18" fill="none"/><ellipse cx="60" cy="60" rx="52" ry="18" transform="rotate(60 60 60)"/><ellipse cx="60" cy="60" rx="52" ry="18" transform="rotate(-60 60 60)"/><circle cx="60" cy="60" r="10" fill="${R}"/>`)],
  // Estruturas químicas
  ['cumarina', 'Cumarina', svg(170, 120, `<path d="M40 20 L74 40 V80 L40 100 L6 80 V40 Z" fill="${W}"/><path d="M74 40 L108 20 L142 40 V80 L108 100 L74 80" fill="${V}"/><path d="M142 80 L160 92 M142 82 L158 92" /><circle cx="40" cy="60" r="18" stroke-width="2.4"/><text x="104" y="114" font-family="Arial" font-size="14" font-weight="700" fill="${O}" stroke="none">O</text><text x="152" y="110" font-family="Arial" font-size="14" font-weight="700" fill="${O}" stroke="none">O</text>`)],
  ['flavona', 'Flavona', svg(190, 130, `<path d="M40 30 L72 48 V84 L40 102 L8 84 V48 Z" fill="${Am}"/><path d="M72 48 L104 30 L136 48 V84 L104 102 L72 84" fill="${W}"/><path d="M136 48 L160 34 L184 48 V76 L160 90 L136 76" fill="${R}"/><circle cx="40" cy="66" r="16" stroke-width="2.4"/><circle cx="160" cy="62" r="12" stroke-width="2.2"/><path d="M104 102 V120"/><text x="110" y="124" font-family="Arial" font-size="14" font-weight="700" fill="${O}" stroke="none">O</text>`)],
  ['alcaloide', 'Núcleo nitrogenado', svg(130, 120, `<path d="M60 14 L98 36 V80 L60 102 L22 80 V36 Z" fill="${A}"/><circle cx="60" cy="102" r="12" fill="${W}"/><text x="60" y="108" text-anchor="middle" font-family="Arial" font-size="15" font-weight="700" fill="${O}" stroke="none">N</text><path d="M98 36 L120 24"/>`)],
  // Tubos de ensaio
  ['tubo-roxo', 'Tubo de ensaio', svg(60, 140, `<path d="M16 10 V116 A14 14 0 0 0 44 116 V10"/><path d="M10 10 H50"/><path d="M16 70 H44 V116 A14 14 0 0 1 16 116Z" fill="${Li}"/><circle cx="28" cy="96" r="3" fill="${W}"/>`)],
  ['tubos-suporte', 'Tubos no suporte', svg(150, 130, `${[0, 1, 2].map((i) => `<path d="M${28 + i * 40} 8 V96 A10 10 0 0 0 ${48 + i * 40} 96 V8" /><path d="M${28 + i * 40} ${56 + i * 6} H${48 + i * 40} V96 A10 10 0 0 1 ${28 + i * 40} 96Z" fill="${[R, V, A][i]}"/>`).join('')}<path d="M10 70 H140 V84 H10Z" fill="${Am}"/><path d="M18 84 V124 M132 84 V124"/>`)],
  ['erlenmeyer', 'Erlenmeyer', svg(110, 130, `<path d="M42 8 H68 M45 8 V46 L10 116 A6 6 0 0 0 16 124 H94 A6 6 0 0 0 100 116 L65 46 V8"/><path d="M27 84 H83 L100 116 A6 6 0 0 1 94 124 H16 A6 6 0 0 1 10 116Z" fill="${V}"/><circle cx="46" cy="104" r="4" fill="${W}"/><circle cx="62" cy="96" r="3" fill="${W}"/>`)],
  ['balao', 'Balão de fundo redondo', svg(110, 130, `<path d="M45 6 H65 M48 6 V48 A36 36 0 1 0 62 48 V6"/><path d="M20 84 A36 36 0 0 0 90 84 Z" fill="${R}"/>`)],
  // Laboratório
  ['microscopio', 'Microscópio', svg(120, 130, `<path d="M30 122 H100" stroke-width="4"/><path d="M50 122 V108 H90"/><path d="M70 108 C96 100 100 70 82 52"/><path d="M40 16 L62 8 L80 54 L58 62 Z" fill="${L}"/><path d="M58 62 L54 76" /><circle cx="54" cy="80" r="5" fill="${A}"/><path d="M36 86 H76" stroke-width="4"/>`)],
  ['pipeta', 'Pipeta', svg(60, 150, `<path d="M30 8 V18"/><path d="M20 18 H40 V34 H20Z" fill="${R}"/><path d="M26 34 V120 L30 140 L34 120 V34"/><path d="M26 90 H34 V120 L30 136 L26 120Z" fill="${A}"/>`)],
  ['placa-petri', 'Placa de Petri', svg(130, 90, `<ellipse cx="65" cy="45" rx="56" ry="34" fill="${W}"/><ellipse cx="65" cy="45" rx="46" ry="26" fill="${V}" fill-opacity=".6"/><circle cx="50" cy="40" r="6" fill="${Am}"/><circle cx="76" cy="52" r="5" fill="${R}"/><circle cx="80" cy="34" r="4" fill="${L}"/>`)],
  ['oculos', 'Óculos de proteção', svg(140, 70, `<path d="M10 24 H130 V46 C130 58 120 62 108 62 H86 L70 50 L54 62 H32 C20 62 10 58 10 46Z" fill="${A}" fill-opacity=".7"/><path d="M10 24 C10 16 16 12 24 12 H116 C124 12 130 16 130 24"/>`)],
  // Farmácia
  ['capsula', 'Cápsula', svg(130, 70, `<rect x="8" y="12" width="114" height="46" rx="23" fill="${W}"/><path d="M65 12 H99 A23 23 0 0 1 99 58 H65Z" fill="${R}"/><path d="M65 12 V58"/>`)],
  ['comprimido', 'Comprimido', svg(90, 90, `<circle cx="45" cy="45" r="36" fill="${A}"/><path d="M20 45 H70" stroke-width="3"/>`)],
  ['frasco', 'Frasco de xarope', svg(90, 140, `<path d="M30 6 H60 V24 H30Z" fill="${L}"/><path d="M34 24 V36 C14 44 10 56 10 70 V126 A8 8 0 0 0 18 134 H72 A8 8 0 0 0 80 126 V70 C80 56 76 44 56 36 V24"/><path d="M10 84 H80 V126 A8 8 0 0 1 72 134 H18 A8 8 0 0 1 10 126Z" fill="${Am}"/><rect x="22" y="64" width="46" height="30" rx="4" fill="${W}"/><path d="M45 72 V86 M38 79 H52" stroke-width="3"/>`)],
  ['cruz-farmacia', 'Cruz da farmácia', svg(100, 100, `<path d="M36 8 H64 V36 H92 V64 H64 V92 H36 V64 H8 V36 H36Z" fill="${V}"/>`)],
  ['almofariz', 'Gral e pistilo', svg(120, 110, `<path d="M10 50 H110 C110 80 90 96 60 96 C30 96 10 80 10 50Z" fill="${L}"/><path d="M40 96 L34 106 H86 L80 96"/><path d="M70 50 L102 8" stroke-width="8"/><path d="M70 50 L102 8" stroke="${W}" stroke-width="3"/>`)],
  // Notas
  ['nota-amarela', 'Nota amarela', note(Am, 'Importante!')],
  ['nota-rosa', 'Nota rosa', note(R, 'Cai na prova')],
  ['nota-azul', 'Nota azul', note(A, 'Lembrar')],
  ['nota-verde', 'Nota verde', note(V, 'Revisar')],
  // Lembretes
  ['alarme', 'Lembrete', svg(110, 120, `<circle cx="55" cy="66" r="40" fill="${W}"/><path d="M55 40 V66 L72 78"/><path d="M18 30 L34 14 M92 30 L76 14" stroke-width="5"/><path d="M28 104 L20 114 M82 104 L90 114"/>`)],
  ['calendario', 'Data da prova', svg(120, 120, `<rect x="10" y="20" width="100" height="90" rx="10" fill="${W}"/><path d="M10 44 H110"/><path d="M10 30 C10 24 14 20 20 20 H100 C106 20 110 24 110 30 V44 H10Z" fill="${R}"/><path d="M36 10 V28 M84 10 V28"/><text x="60" y="94" text-anchor="middle" font-family="Arial" font-size="36" font-weight="700" fill="${O}" stroke="none">!</text>`)],
  ['alfinete', 'Alfinete', svg(80, 120, `<circle cx="40" cy="32" r="24" fill="${R}"/><circle cx="32" cy="24" r="6" fill="${W}" stroke="none"/><path d="M40 56 V112"/>`)],
  // Setas
  ['seta-curva', 'Seta curva', svg(140, 90, `<path d="M10 70 C30 10 100 6 124 46" stroke-width="4"/><path d="M106 44 L126 50 L130 28" stroke-width="4"/>`)],
  ['seta-grossa', 'Seta grossa', svg(140, 70, `<path d="M8 22 H88 V6 L132 35 L88 64 V48 H8Z" fill="${L}"/>`)],
  ['seta-dupla', 'Equilíbrio', svg(140, 60, `<path d="M10 20 H128 L114 8" stroke-width="3.5"/><path d="M130 40 H12 L26 52" stroke-width="3.5"/>`)],
  ['seta-rabisco', 'Seta rabiscada', svg(150, 80, `<path d="M8 60 C26 40 40 70 56 50 C72 30 86 60 104 40 L138 24" stroke-width="3.5"/><path d="M118 18 L140 22 L132 44" stroke-width="3.5"/>`)],
  // Etiquetas
  ['etiqueta-definicao', 'Definição', label(L, 'DEFINIÇÃO')],
  ['etiqueta-exemplo', 'Exemplo', label(A, 'EXEMPLO')],
  ['etiqueta-mecanismo', 'Mecanismo', label(V, 'MECANISMO')],
  ['etiqueta-uso', 'Uso terapêutico', label(R, 'USO CLÍNICO')],
  ['etiqueta-prova', 'Prova', label(Am, 'PROVA')],
  // Estrelas
  ['estrela-amarela', 'Estrela amarela', star(Am)],
  ['estrela-rosa', 'Estrela rosa', star(R)],
  ['brilho', 'Brilho', sparkle(W)],
  ['brilho-lilas', 'Brilho lilás', sparkle(Li)],
  // Decorativos
  ['coracao', 'Coração', svg(110, 100, `<path d="M55 92 C20 66 6 48 6 30 C6 14 18 6 30 6 C42 6 50 14 55 24 C60 14 68 6 80 6 C92 6 104 14 104 30 C104 48 90 66 55 92Z" fill="${R}"/>`)],
  ['washi-lilas', 'Fita washi lilás', svg(200, 44, `<path d="M6 6 L194 6 L188 22 L194 38 L6 38 L12 22 Z" fill="${Li}" fill-opacity=".85" stroke-width="2"/>${Array.from({ length: 8 }, (_, i) => `<circle cx="${22 + i * 22}" cy="22" r="4" fill="${W}" stroke="none"/>`).join('')}`)],
  ['washi-verde', 'Fita washi verde', svg(200, 44, `<path d="M6 6 L194 6 L188 22 L194 38 L6 38 L12 22 Z" fill="${V}" fill-opacity=".85" stroke-width="2"/>${Array.from({ length: 9 }, (_, i) => `<path d="M${16 + i * 20} 34 L${28 + i * 20} 10" stroke="${W}" stroke-width="3"/>`).join('')}`)],
  ['nuvem', 'Nuvem', svg(140, 90, `<path d="M30 80 C12 80 6 64 14 54 C8 38 24 26 38 32 C42 14 66 8 78 22 C90 10 114 16 116 36 C132 38 136 60 124 70 C122 78 116 80 110 80Z" fill="${A}"/>`)],
  ['lua', 'Lua', svg(100, 100, `<path d="M70 10 C40 14 22 40 30 66 C38 88 64 96 88 84 C60 82 44 56 52 34 C56 24 62 16 70 10Z" fill="${Am}"/>`)],
];

const CATEGORY_OF: Record<string, string> = {};
const CATS: Array<[string, string[]]> = [
  ['Plantas', ['planta-vaso', 'ramo', 'erva', 'cacto']],
  ['Folhas', ['folha-verde', 'folha-lilas', 'folha-ginkgo', 'trevo']],
  ['Flores', ['flor-rosa', 'margarida', 'lavanda', 'tulipa']],
  ['Moléculas', ['benzeno', 'benzeno-lilas', 'fenol', 'molecula', 'atomo']],
  ['Estruturas químicas', ['cumarina', 'flavona', 'alcaloide']],
  ['Tubos de ensaio', ['tubo-roxo', 'tubos-suporte', 'erlenmeyer', 'balao']],
  ['Laboratório', ['microscopio', 'pipeta', 'placa-petri', 'oculos']],
  ['Farmácia', ['capsula', 'comprimido', 'frasco', 'cruz-farmacia', 'almofariz']],
  ['Notas', ['nota-amarela', 'nota-rosa', 'nota-azul', 'nota-verde']],
  ['Lembretes', ['alarme', 'calendario', 'alfinete']],
  ['Setas', ['seta-curva', 'seta-grossa', 'seta-dupla', 'seta-rabisco']],
  ['Etiquetas', ['etiqueta-definicao', 'etiqueta-exemplo', 'etiqueta-mecanismo', 'etiqueta-uso', 'etiqueta-prova']],
  ['Estrelas', ['estrela-amarela', 'estrela-rosa', 'brilho', 'brilho-lilas']],
  ['Decorativos', ['coracao', 'washi-lilas', 'washi-verde', 'nuvem', 'lua']],
];
for (const [cat, ids] of CATS) for (const id of ids) CATEGORY_OF[id] = cat;

export const STICKER_CATEGORIES = CATS.map(([c]) => c);

export const STICKERS: StickerDef[] = RAW.map(([id, name, s]) => ({ id: `stk:${id}`, name, category: CATEGORY_OF[id] ?? 'Decorativos', svg: s }));

const byId = new Map(STICKERS.map((s) => [s.id, s]));

export function stickerUrl(id: string): string | null {
  const s = byId.get(id);
  return s ? 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(s.svg) : null;
}

export function stickerSize(id: string): { w: number; h: number } {
  const s = byId.get(id);
  const m = s?.svg.match(/viewBox="0 0 (\d+) (\d+)"/);
  return m ? { w: Number(m[1]), h: Number(m[2]) } : { w: 100, h: 100 };
}

/*
 * "Virar anotação": a IA (Claude) lê uma imagem (resumo, mapa mental, esquema)
 * e devolve o que tem nela, separado em texto, setas, caixas, marca-texto e figuras.
 * O editor transforma isso em escrita à mão editável na página.
 *
 * A chave da Anthropic fica só neste navegador (localStorage) e nunca é sincronizada.
 */

const KEY = 'caderno:ia:chave';
export const AI_MODEL = 'claude-opus-5-5';

export function getAiKey(): string {
  try {
    return localStorage.getItem(KEY) ?? '';
  } catch {
    return '';
  }
}

export function setAiKey(k: string) {
  try {
    if (k) localStorage.setItem(KEY, k);
    else localStorage.removeItem(KEY);
  } catch {
    /* sem armazenamento */
  }
}

export type AiKind = 'texto' | 'seta' | 'linha' | 'retangulo' | 'elipse' | 'losango' | 'marcatexto' | 'figura';

/** Coordenadas de 0 a 1000, relativas à largura (x) e altura (y) da imagem. */
export interface AiItem {
  tipo: AiKind;
  texto: string;
  x: number;
  y: number;
  largura: number;
  altura: number;
  x2: number;
  y2: number;
  cor: string;
  fundo: string;
  tamanho: number;
}

const SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['itens'],
  properties: {
    itens: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['tipo', 'texto', 'x', 'y', 'largura', 'altura', 'x2', 'y2', 'cor', 'fundo', 'tamanho'],
        properties: {
          tipo: { type: 'string', enum: ['texto', 'seta', 'linha', 'retangulo', 'elipse', 'losango', 'marcatexto', 'figura'] },
          texto: { type: 'string' },
          x: { type: 'number' },
          y: { type: 'number' },
          largura: { type: 'number' },
          altura: { type: 'number' },
          x2: { type: 'number' },
          y2: { type: 'number' },
          cor: { type: 'string' },
          fundo: { type: 'string' },
          tamanho: { type: 'number' },
        },
      },
    },
  },
} as const;

const PROMPT = `Esta imagem é material de estudo (resumo, mapa mental, esquema, tabela ou infográfico).
Quero redesenhá-la num caderno digital como se tivesse sido escrita à mão. Descreva TUDO o que aparece nela como uma lista de itens, com posições medidas na imagem.

Coordenadas: de 0 a 1000. x vai da esquerda (0) à direita (1000) da imagem; y vai do topo (0) à base (1000). Meça com cuidado: a posição de cada item na página final vem só daqui.

Tipos de item:
- "texto": um bloco de texto (título, tópico, frase, rótulo, célula de tabela). Copie o texto exatamente, com acentos, na língua original. Um bloco por linha ou parágrafo visualmente separado; listas com marcador viram um item por tópico, começando com "• ". Use x,y para o canto superior esquerdo, largura e altura para a caixa ocupada pelo texto. "tamanho" = altura de uma linha de letra, na mesma escala de 0 a 1000 (título grande ~40, texto normal ~18). Fórmulas químicas: use subscritos Unicode (H₂O, C₆H₆).
- "seta" e "linha": de (x,y) até (x2,y2); na seta a ponta fica em (x2,y2).
- "retangulo", "elipse", "losango": contornos de caixas, balões e destaques. x,y = canto superior esquerdo; largura, altura. Se tiverem cor de fundo, coloque em "fundo".
- "marcatexto": uma faixa colorida de destaque atrás de um texto. x,y,largura,altura e "cor".
- "figura": desenhos, ícones, ilustrações, estruturas moleculares, fotos e gráficos que não dá para escrever. Só a caixa (x,y,largura,altura) bem justa em volta do desenho, sem incluir textos que você já listou.

"cor": cor da tinta em hexadecimal (#rrggbb). "fundo": cor de preenchimento em hexadecimal, ou "" se não houver.
Campos que não se aplicam ao tipo: use 0 nos números e "" nos textos.
Não invente conteúdo e não omita textos. Ignore o fundo liso da imagem e marcas d'água.`;

export class AiError extends Error {}

function blobToBase64(b: Blob): Promise<string> {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => {
      const s = String(r.result);
      res(s.slice(s.indexOf(',') + 1));
    };
    r.onerror = () => rej(r.error);
    r.readAsDataURL(b);
  });
}

export async function readImageItems(image: { base64: string } | Blob, apiKey = getAiKey()): Promise<AiItem[]> {
  if (!apiKey) throw new AiError('Coloque sua chave da Anthropic em Ajustes para usar esta função.');
  const data = image instanceof Blob ? await blobToBase64(image) : image.base64;
  const { default: Anthropic } = await import('@anthropic-ai/sdk');
  const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true, maxRetries: 1 });

  let resp;
  try {
    resp = await client.beta.messages.create({
      model: AI_MODEL,
      max_tokens: 16000,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      output_config: { effort: 'medium', format: { type: 'json_schema', schema: SCHEMA } },
      messages: [
        {
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data } },
            { type: 'text', text: PROMPT },
          ],
        },
      ],
    });
  } catch (e) {
    if (e instanceof Anthropic.AuthenticationError) throw new AiError('A chave da Anthropic não foi aceita. Confira em Ajustes.');
    if (e instanceof Anthropic.PermissionDeniedError) throw new AiError('Esta chave não tem permissão para usar o modelo.');
    if (e instanceof Anthropic.RateLimitError) throw new AiError('Muitos pedidos seguidos. Espere um minuto e tente de novo.');
    if (e instanceof Anthropic.BadRequestError) {
      const msg = e.message ?? '';
      if (/credit|balance|billing/i.test(msg)) throw new AiError('Sua conta da Anthropic está sem crédito. Recarregue em console.anthropic.com > Billing.');
      throw new AiError(`A IA recusou o pedido: ${msg}`);
    }
    if (e instanceof Anthropic.APIConnectionError) throw new AiError('Sem conexão com a IA. Confira a internet.');
    if (e instanceof Anthropic.APIError) throw new AiError(`Erro da IA (${e.status ?? '?'}): ${e.message}`);
    throw e;
  }

  if (resp.stop_reason === 'refusal') throw new AiError('A IA não quis ler esta imagem.');
  if (resp.stop_reason === 'max_tokens') throw new AiError('A imagem tem coisa demais para ler de uma vez. Recorte em partes e tente cada uma.');
  const text = resp.content.map((b) => (b.type === 'text' ? b.text : '')).join('');
  try {
    const parsed = JSON.parse(text) as { itens: AiItem[] };
    return Array.isArray(parsed.itens) ? parsed.itens : [];
  } catch {
    throw new AiError('A resposta da IA veio incompleta. Tente de novo.');
  }
}

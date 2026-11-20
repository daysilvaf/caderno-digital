export type SectionStatus = 'nao-iniciada' | 'em-andamento' | 'revisar' | 'concluida';

export const STATUS_LABEL: Record<SectionStatus, string> = {
  'nao-iniciada': 'Não iniciada',
  'em-andamento': 'Em andamento',
  revisar: 'Revisar',
  concluida: 'Concluída',
};

export const STATUS_ORDER: SectionStatus[] = ['nao-iniciada', 'em-andamento', 'revisar', 'concluida'];

export type PaperColor = 'preto' | 'grafite' | 'branco' | 'creme' | 'custom';
export type PaperPattern = 'liso' | 'quadriculado' | 'pontilhado' | 'linhas';

export interface PageTemplate {
  color: PaperColor;
  customColor?: string;
  pattern: PaperPattern;
}

import type { El } from './editor/elements';

/** Elementos desenhados/inseridos na página (traços, formas, textos). */
export type PageElement = El;

export interface Notebook {
  id: string;
  title: string;
  subtitle: string;
  coverColor: string;
  defaultTemplate: PageTemplate;
  createdAt: number;
  updatedAt: number;
}

export interface Section {
  id: string;
  notebookId: string;
  number: string;
  title: string;
  order: number;
  status: SectionStatus;
  favorite: number; // 0/1 (indexável no IndexedDB)
  tags: string[];
  updatedAt: number;
}

export interface Page {
  id: string;
  sectionId: string;
  order: number;
  title: string;
  template: PageTemplate;
  width: number;
  height: number;
  favorite: number;
  bookmarked: number;
  tags: string[];
  elements: PageElement[];
  /** Fundo de imagem (página de PDF importado). */
  background?: { assetId: string };
  thumbnail?: string;
  createdAt: number;
  updatedAt: number;
}

export type AssetKind = 'imagem' | 'pdf' | 'documento' | 'sticker' | 'pagina-pdf';

export interface Asset {
  id: string;
  kind: AssetKind;
  name: string;
  mime: string;
  size: number;
  blob: Blob;
  /** dimensões em pixels (imagens) */
  w?: number;
  h?: number;
  /** páginas de um PDF apontam para o PDF de origem */
  parentId?: string;
  /** aula para onde o PDF foi importado */
  sectionId?: string;
  pageCount?: number;
  createdAt: number;
  updatedAt?: number;
}

export const PAPER_COLORS: Record<Exclude<PaperColor, 'custom'>, { bg: string; ink: string; line: string; label: string }> = {
  preto: { bg: '#141417', ink: '#f2eefa', line: 'rgba(255,255,255,0.09)', label: 'Preto' },
  grafite: { bg: '#2b2b31', ink: '#f2eefa', line: 'rgba(255,255,255,0.10)', label: 'Grafite' },
  branco: { bg: '#ffffff', ink: '#1d1d22', line: 'rgba(60,60,90,0.13)', label: 'Branco' },
  creme: { bg: '#f8f1e3', ink: '#2a2620', line: 'rgba(110,90,60,0.16)', label: 'Creme' },
};

export const PATTERN_LABEL: Record<PaperPattern, string> = {
  liso: 'Liso',
  quadriculado: 'Quadriculado',
  pontilhado: 'Pontilhado',
  linhas: 'Linhas',
};

export const PAGE_SIZES = {
  a4: { w: 794, h: 1123, label: 'A4 retrato' },
  a4l: { w: 1123, h: 794, label: 'A4 paisagem' },
  quadrado: { w: 1000, h: 1000, label: 'Quadrado' },
  tela: { w: 1280, h: 800, label: 'Widescreen' },
} as const;

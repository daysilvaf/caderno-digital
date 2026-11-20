/**
 * Conexão com o Supabase (sincronização entre aparelhos).
 * A "anon key" é pública por natureza: quem protege os dados são as regras (RLS)
 * do arquivo supabase/setup.sql. Também dá para colar os dois valores na tela de Ajustes.
 */
export const SUPABASE_URL: string = import.meta.env.VITE_SUPABASE_URL ?? '';
export const SUPABASE_ANON_KEY: string = import.meta.env.VITE_SUPABASE_ANON_KEY ?? '';

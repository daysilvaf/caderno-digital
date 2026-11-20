/**
 * Conexão com o Supabase (sincronização entre aparelhos).
 * A chave "publishable" é pública por natureza: quem protege os dados são as regras (RLS)
 * do arquivo supabase/setup.sql, que deixam cada pessoa ver só o próprio caderno.
 * Variáveis de ambiente (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY) têm prioridade, se existirem.
 */
export const SUPABASE_URL: string = import.meta.env.VITE_SUPABASE_URL || 'https://takjqeftncvbteexcmhm.supabase.co';
export const SUPABASE_ANON_KEY: string = import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_2TK1ZXDjZZ_uF1ooZ1SLsg_yc7MtyFc';

import type { Session, SupabaseClient } from '@supabase/supabase-js';
import { useEffect, useState } from 'react';
import { SUPABASE_ANON_KEY, SUPABASE_URL } from './config';
import { db, tagTransaction } from './db';
import type { Asset } from './types';

/*
 * Sincronização entre aparelhos (Supabase).
 *
 * - O caderno continua funcionando 100% offline no IndexedDB.
 * - Cada alteração local entra numa fila (localStorage) e é enviada alguns segundos depois.
 * - Ao abrir, a cada 30 s e quando a internet volta, o app baixa o que mudou na nuvem.
 * - Conflito: vence a versão editada por último (campo updatedAt).
 * - Arquivos (PDFs, imagens) vão para o Storage, numa pasta só da usuária.
 */

type TableName = 'notebooks' | 'sections' | 'pages' | 'assets';
const TABLES: TableName[] = ['notebooks', 'sections', 'pages', 'assets'];
const BUCKET = 'arquivos';
const REMOTE = 'caderno_dados';

const LS_OUTBOX = 'caderno:sync:fila';
const LS_MARK = 'caderno:sync:marca';
const LS_CONFIG = 'caderno:sync:config';
const LS_PENDING_FILES = 'caderno:sync:arquivos-pendentes';

// ---------------- estado observável ----------------

export interface SyncState {
  configured: boolean;
  email: string | null;
  status: 'desligada' | 'ociosa' | 'sincronizando' | 'erro' | 'offline';
  lastSync: number | null;
  pending: number;
  message: string | null;
}

let state: SyncState = { configured: false, email: null, status: 'desligada', lastSync: null, pending: 0, message: null };
const listeners = new Set<(s: SyncState) => void>();
function setState(p: Partial<SyncState>) {
  state = { ...state, ...p };
  listeners.forEach((l) => l(state));
}
export function useSyncState() {
  const [s, set] = useState(state);
  useEffect(() => {
    listeners.add(set);
    set(state);
    return () => {
      listeners.delete(set);
    };
  }, []);
  return s;
}

// Avisa o editor quando uma página aberta mudou em outro aparelho.
const remotePageListeners = new Set<(id: string) => void>();
export function onRemotePageChange(fn: (id: string) => void) {
  remotePageListeners.add(fn);
  return () => {
    remotePageListeners.delete(fn);
  };
}

// ---------------- fila de envio ----------------

type Outbox = Record<string, { t: TableName; id: string; del?: boolean }>;
function readLS<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}
function writeLS(key: string, v: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(v));
  } catch {
    /* sem armazenamento */
  }
}
function enqueue(t: TableName, id: string, del = false) {
  const box = readLS<Outbox>(LS_OUTBOX, {});
  box[`${t}:${id}`] = { t, id, del };
  writeLS(LS_OUTBOX, box);
  setState({ pending: Object.keys(box).length });
  schedulePush();
}

function dropFromOutbox(key: string) {
  const box = readLS<Outbox>(LS_OUTBOX, {});
  delete box[key];
  writeLS(LS_OUTBOX, box);
  setState({ pending: Object.keys(box).length });
}

// Ganchos do banco local: carimbam a data de edição e enfileiram o envio.
type TxTags = { __remote?: boolean; __seed?: boolean };
for (const t of TABLES) {
  const table = db.table(t);
  table.hook('creating', function (primKey, obj, tx) {
    const tags = tx as unknown as TxTags;
    if (tags.__remote || tags.__seed) return;
    if (t !== 'assets') (obj as { updatedAt?: number }).updatedAt = Date.now();
    else (obj as Asset).updatedAt = Date.now();
    const id = String(primKey ?? (obj as { id: string }).id);
    tx.on('complete', () => enqueue(t, id));
  });
  table.hook('updating', function (_mods, primKey, _obj, tx) {
    const tags = tx as unknown as TxTags;
    if (tags.__remote) return;
    tx.on('complete', () => enqueue(t, String(primKey)));
    return { updatedAt: Date.now() };
  });
  table.hook('deleting', function (primKey, _obj, tx) {
    const tags = tx as unknown as TxTags;
    if (tags.__remote) return;
    tx.on('complete', () => enqueue(t, String(primKey), true));
  });
}

// ---------------- configuração e login ----------------

export function getConfig(): { url: string; key: string } {
  const saved = readLS<{ url: string; key: string } | null>(LS_CONFIG, null);
  return { url: saved?.url || SUPABASE_URL, key: saved?.key || SUPABASE_ANON_KEY };
}
export function saveConfig(url: string, key: string) {
  writeLS(LS_CONFIG, { url: url.trim().replace(/\/$/, ''), key: key.trim() });
  client = null;
  setState({ configured: !!(url && key) });
}

let client: SupabaseClient | null = null;
let session: Session | null = null;

async function getClient() {
  if (client) return client;
  const { url, key } = getConfig();
  if (!url || !key) return null;
  const { createClient } = await import('@supabase/supabase-js');
  client = createClient(url, key, { auth: { persistSession: true, storageKey: 'caderno:sync:sessao' } });
  client.auth.onAuthStateChange((_e, s) => {
    session = s;
    setState({ email: s?.user.email ?? null, status: s ? state.status === 'desligada' ? 'ociosa' : state.status : 'desligada' });
  });
  return client;
}

export async function initSync() {
  const { url, key } = getConfig();
  setState({ configured: !!(url && key), pending: Object.keys(readLS<Outbox>(LS_OUTBOX, {})).length });
  const c = await getClient().catch(() => null);
  if (!c) return;
  const { data } = await c.auth.getSession();
  session = data.session;
  if (session) {
    setState({ email: session.user.email ?? null, status: 'ociosa' });
    startLoop();
  }
}

export async function signIn(email: string, password: string, create: boolean) {
  const c = await getClient();
  if (!c) throw new Error('Preencha o endereço e a chave do Supabase primeiro.');
  const res = create ? await c.auth.signUp({ email, password }) : await c.auth.signInWithPassword({ email, password });
  if (res.error) throw new Error(traduzErro(res.error.message));
  if (!res.data.session) return 'confirme'; // cadastro com confirmação por e-mail ligada
  session = res.data.session;
  setState({ email: session.user.email ?? null, status: 'ociosa' });
  // Primeiro login neste aparelho: tudo o que existe aqui vai para a fila.
  await enqueueEverything();
  startLoop();
  syncNow();
  return 'ok';
}

export async function signOut() {
  const c = await getClient();
  await c?.auth.signOut();
  session = null;
  stopLoop();
  writeLS(LS_MARK, null);
  setState({ email: null, status: 'desligada' });
}

function traduzErro(msg: string) {
  if (/invalid login/i.test(msg)) return 'E-mail ou senha incorretos.';
  if (/already registered/i.test(msg)) return 'Esse e-mail já tem conta. Use "Entrar".';
  if (/password should be/i.test(msg)) return 'A senha precisa ter pelo menos 6 caracteres.';
  if (/email not confirmed/i.test(msg)) return 'Confirme o e-mail (veja sua caixa de entrada) e tente de novo.';
  if (/fetch/i.test(msg)) return 'Sem conexão com o Supabase. Confira o endereço e a internet.';
  return msg;
}

async function enqueueEverything() {
  const box = readLS<Outbox>(LS_OUTBOX, {});
  for (const t of TABLES) {
    const keys = (await db.table(t).toCollection().primaryKeys()) as string[];
    for (const id of keys) box[`${t}:${id}`] = { t, id };
  }
  writeLS(LS_OUTBOX, box);
  setState({ pending: Object.keys(box).length });
}

// ---------------- ciclo ----------------

let loop: number | undefined;
let pushTimer: number | undefined;
let running = false;
let again = false;

function startLoop() {
  stopLoop();
  loop = window.setInterval(() => syncNow(), 30_000);
  window.addEventListener('online', syncNow);
  document.addEventListener('visibilitychange', onVisible);
}
function stopLoop() {
  window.clearInterval(loop);
  window.removeEventListener('online', syncNow);
  document.removeEventListener('visibilitychange', onVisible);
}
function onVisible() {
  if (document.visibilityState === 'visible') syncNow();
}
function schedulePush() {
  if (!session) return;
  window.clearTimeout(pushTimer);
  pushTimer = window.setTimeout(() => syncNow(), 2500);
}

export async function syncNow() {
  if (!session) return;
  if (running) {
    again = true;
    return;
  }
  if (!navigator.onLine) return setState({ status: 'offline', message: 'Sem internet. As alterações ficam guardadas e sobem quando a conexão voltar.' });
  running = true;
  setState({ status: 'sincronizando', message: null });
  try {
    await pull();
    await push();
    await retryPendingFiles();
    setState({ status: 'ociosa', lastSync: Date.now(), message: null });
  } catch (e) {
    console.error('[sync]', e);
    setState({ status: 'erro', message: e instanceof Error ? traduzErro(e.message) : 'Erro ao sincronizar.' });
  } finally {
    running = false;
    if (again) {
      again = false;
      setTimeout(syncNow, 500);
    }
  }
}

function version(rec: { updatedAt?: number; createdAt?: number } | undefined) {
  return rec?.updatedAt ?? rec?.createdAt ?? 0;
}

// ---------------- enviar ----------------

async function push() {
  const c = client!;
  const uid = session!.user.id;
  let box = readLS<Outbox>(LS_OUTBOX, {});
  const entries = Object.entries(box);
  if (!entries.length) return;

  for (let i = 0; i < entries.length; i += 50) {
    const chunk = entries.slice(i, i + 50);
    // Versões da nuvem, para não sobrescrever algo mais novo vindo de outro aparelho.
    const remoteVer = new Map<string, number>();
    for (const t of TABLES) {
      const ids = chunk.filter(([, v]) => v.t === t).map(([, v]) => v.id);
      if (!ids.length) continue;
      const { data, error } = await c.from(REMOTE).select('tabela,id,atualizado').eq('tabela', t).in('id', ids);
      if (error) throw error;
      data?.forEach((r) => remoteVer.set(`${r.tabela}:${r.id}`, Number(r.atualizado)));
    }

    const rows: Array<Record<string, unknown>> = [];
    const done: string[] = [];
    for (const [key, item] of chunk) {
      const local = item.del ? undefined : await db.table(item.t).get(item.id);
      if (!local) {
        rows.push({ user_id: uid, tabela: item.t, id: item.id, dados: null, excluido: true, atualizado: Date.now() });
        if (item.t === 'assets') await c.storage.from(BUCKET).remove([`${uid}/${item.id}`]);
        done.push(key);
        continue;
      }
      const v = version(local);
      if ((remoteVer.get(key) ?? -1) > v) {
        done.push(key); // a nuvem já tem uma versão mais nova
        continue;
      }
      let dados: unknown = local;
      if (item.t === 'assets') {
        const { blob, ...meta } = local as Asset;
        const up = await c.storage.from(BUCKET).upload(`${uid}/${item.id}`, blob, { upsert: true, contentType: (local as Asset).mime || 'application/octet-stream' });
        if (up.error && !/exists/i.test(up.error.message)) throw up.error;
        dados = meta;
      }
      rows.push({ user_id: uid, tabela: item.t, id: item.id, dados, excluido: false, atualizado: v });
      done.push(key);
    }
    if (rows.length) {
      const { error } = await c.from(REMOTE).upsert(rows, { onConflict: 'user_id,tabela,id' });
      if (error) throw error;
    }
    // Tira da fila só o que foi enviado e não mudou de novo nesse meio-tempo.
    box = readLS<Outbox>(LS_OUTBOX, {});
    const sentNow = new Set(done);
    for (const k of sentNow) {
      const cur = box[k];
      const orig = chunk.find(([kk]) => kk === k)?.[1];
      if (cur && orig && cur.del === orig.del) delete box[k];
    }
    writeLS(LS_OUTBOX, box);
    setState({ pending: Object.keys(box).length });
  }
}

// ---------------- receber ----------------

async function pull() {
  const c = client!;
  const uid = session!.user.id;
  let mark = readLS<string | null>(LS_MARK, null);
  for (;;) {
    let q = c.from(REMOTE).select('*').order('sincronizado', { ascending: true }).limit(200);
    if (mark) {
      // pequena folga de 5 s para não perder gravações simultâneas
      const since = new Date(new Date(mark).getTime() - 5000).toISOString();
      q = q.gt('sincronizado', since);
    }
    const { data, error } = await q;
    if (error) throw error;
    if (!data?.length) break;
    const outbox = readLS<Outbox>(LS_OUTBOX, {});
    for (const row of data) {
      const t = row.tabela as TableName;
      if (!TABLES.includes(t)) continue;
      const key = `${t}:${row.id}`;
      const local = await db.table(t).get(row.id);
      const pendingLocal = outbox[key];
      // Vence a versão mais recente. Exclusão local pendente: ela decide no envio.
      if (pendingLocal?.del) continue;
      if (row.excluido) {
        if (pendingLocal && local && version(local) > Number(row.atualizado)) continue;
        if (pendingLocal) dropFromOutbox(key);
        if (local) await db.transaction('rw', db.table(t), async () => {
          tagTransaction('__remote');
          await db.table(t).delete(row.id);
        });
        continue;
      }
      if (local && version(local) >= Number(row.atualizado)) continue;
      if (pendingLocal) dropFromOutbox(key); // a nuvem tem algo mais novo que a alteração local
      let rec = row.dados as Record<string, unknown>;
      if (t === 'assets') {
        const blob = await downloadFile(uid, row.id);
        if (!blob) {
          const pend = readLS<string[]>(LS_PENDING_FILES, []);
          if (!pend.includes(row.id)) writeLS(LS_PENDING_FILES, [...pend, row.id]);
          continue;
        }
        rec = { ...rec, blob };
      }
      await db.transaction('rw', db.table(t), async () => {
        tagTransaction('__remote');
        await db.table(t).put(rec);
      });
      if (t === 'pages') remotePageListeners.forEach((l) => l(row.id));
    }
    const last = data[data.length - 1].sincronizado as string;
    if (last === mark) break;
    mark = last;
    writeLS(LS_MARK, mark);
    if (data.length < 200) break;
  }
}

async function downloadFile(uid: string, id: string): Promise<Blob | null> {
  const { data, error } = await client!.storage.from(BUCKET).download(`${uid}/${id}`);
  if (error) return null;
  return data;
}

async function retryPendingFiles() {
  const pend = readLS<string[]>(LS_PENDING_FILES, []);
  if (!pend.length) return;
  const uid = session!.user.id;
  const left: string[] = [];
  for (const id of pend) {
    const { data } = await client!.from(REMOTE).select('dados,excluido').eq('tabela', 'assets').eq('id', id).maybeSingle();
    if (!data || data.excluido) continue;
    const blob = await downloadFile(uid, id);
    if (!blob) {
      left.push(id);
      continue;
    }
    await db.transaction('rw', db.assets, async () => {
      tagTransaction('__remote');
      await db.assets.put({ ...(data.dados as Asset), blob });
    });
  }
  writeLS(LS_PENDING_FILES, left);
}

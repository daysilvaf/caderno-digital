import { useState } from 'react';
import { createBackup, restoreBackup } from '../backup';
import { pickFiles, formatBytes } from '../assets';
import { getConfig, saveConfig, signIn, signOut, syncNow, useSyncState } from '../sync';
import { Shell } from './Shell';

export function SettingsView() {
  return (
    <Shell title="Ajustes">
      <h1>Ajustes</h1>
      <p className="sheet-sub">Sincronização entre aparelhos e cópias de segurança.</p>
      <SyncSection />
      <BackupSection />
    </Shell>
  );
}

function SyncSection() {
  const s = useSyncState();
  const cfg = getConfig();
  const [url, setUrl] = useState(cfg.url);
  const [key, setKey] = useState(cfg.key);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [showCfg, setShowCfg] = useState(!cfg.url || !cfg.key);

  const submit = async (create: boolean) => {
    setMsg(null);
    setBusy(true);
    try {
      const r = await signIn(email.trim(), password, create);
      if (r === 'confirme') setMsg('Conta criada. Abra o e-mail de confirmação que o Supabase enviou e depois clique em "Entrar".');
    } catch (e) {
      setMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const statusText: Record<typeof s.status, string> = {
    desligada: 'Desligada',
    ociosa: 'Sincronizado',
    sincronizando: 'Sincronizando…',
    erro: 'Erro',
    offline: 'Sem internet',
  };

  return (
    <section className="settings-block">
      <h3 className="section-label">Sincronização entre aparelhos</h3>
      <p className="hint" style={{ whiteSpace: 'normal' }}>
        Com a sincronização ligada, o mesmo caderno aparece no computador, no tablet e no celular. Tudo continua funcionando sem internet e sobe quando a conexão voltar.
      </p>

      {s.email ? (
        <div className="sync-card">
          <div>
            <div>
              Conectada como <b>{s.email}</b>
            </div>
            <div className="hint">
              <span className={`sync-dot ${s.status}`} /> {statusText[s.status]}
              {s.pending > 0 && ` · ${s.pending} alteração(ões) para enviar`}
              {s.lastSync && ` · última vez às ${new Date(s.lastSync).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`}
            </div>
            {s.message && <div className="hint" style={{ color: 'var(--danger)', whiteSpace: 'normal' }}>{s.message}</div>}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn" onClick={() => syncNow()} disabled={s.status === 'sincronizando'}>
              Sincronizar agora
            </button>
            <button className="btn ghost" onClick={() => signOut()}>
              Sair
            </button>
          </div>
        </div>
      ) : (
        <>
          {showCfg ? (
            <form
              className="form-grid"
              onSubmit={(e) => {
                e.preventDefault();
                saveConfig(url, key);
                setShowCfg(false);
              }}
            >
              <label htmlFor="sb-url">Project URL do Supabase</label>
              <input id="sb-url" className="text-input" placeholder="https://xxxx.supabase.co" value={url} onChange={(e) => setUrl(e.target.value)} />
              <label htmlFor="sb-key">Chave anon public</label>
              <input id="sb-key" className="text-input" placeholder="eyJhbGciOi…" value={key} onChange={(e) => setKey(e.target.value)} />
              <div />
              <button className="btn primary" type="submit" disabled={!url || !key}>
                Salvar conexão
              </button>
            </form>
          ) : (
            <form
              className="form-grid"
              onSubmit={(e) => {
                e.preventDefault();
                submit(false);
              }}
            >
              <label htmlFor="sb-email">E-mail</label>
              <input id="sb-email" className="text-input" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
              <label htmlFor="sb-pass">Senha</label>
              <input id="sb-pass" className="text-input" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
              <div />
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button className="btn primary" type="submit" disabled={busy || !email || !password}>
                  Entrar
                </button>
                <button className="btn" type="button" disabled={busy || !email || !password} onClick={() => submit(true)}>
                  Criar conta
                </button>
                <button className="btn ghost" type="button" onClick={() => setShowCfg(true)}>
                  Alterar conexão
                </button>
              </div>
            </form>
          )}
          {msg && <p className="hint" style={{ whiteSpace: 'normal', color: 'var(--rosa)' }}>{msg}</p>}
        </>
      )}
    </section>
  );
}

function BackupSection() {
  const [msg, setMsg] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);

  return (
    <section className="settings-block">
      <h3 className="section-label">Backup</h3>
      <p className="hint" style={{ whiteSpace: 'normal' }}>
        Salva o caderno inteiro (páginas, escrita, PDFs, imagens e organização) num único arquivo .zip. Guarde no seu Drive ou pendrive.
      </p>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button
          className="btn primary"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            setMsg('Preparando backup…');
            try {
              const r = await createBackup();
              setMsg(`Backup salvo: ${r.pages} páginas, ${r.files} arquivos, ${formatBytes(r.size)}.`);
            } catch {
              setMsg('Não foi possível criar o backup.');
            }
            setBusy(false);
          }}
        >
          Salvar backup
        </button>
        <button
          className="btn"
          disabled={busy}
          onClick={async () => {
            const [f] = await pickFiles('.zip,application/zip', false);
            if (f) setConfirm(f);
          }}
        >
          Restaurar backup…
        </button>
      </div>
      {confirm && (
        <div className="sync-card" style={{ borderColor: 'var(--rosa)' }}>
          <div className="hint" style={{ whiteSpace: 'normal' }}>
            Restaurar <b>{confirm.name}</b> substitui todo o conteúdo atual do caderno. Se quiser, salve um backup antes.
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              className="btn danger"
              onClick={async () => {
                const f = confirm;
                setConfirm(null);
                setBusy(true);
                try {
                  const r = await restoreBackup(f);
                  setMsg(`Backup restaurado: ${r.pages} páginas e ${r.files} arquivos.`);
                } catch (e) {
                  setMsg(e instanceof Error ? e.message : 'Não foi possível restaurar.');
                }
                setBusy(false);
              }}
            >
              Substituir pelo backup
            </button>
            <button className="btn ghost" onClick={() => setConfirm(null)}>
              Cancelar
            </button>
          </div>
        </div>
      )}
      {msg && <p className="hint" style={{ whiteSpace: 'normal' }}>{msg}</p>}
    </section>
  );
}

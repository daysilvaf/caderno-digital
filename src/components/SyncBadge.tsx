import { Icon } from '../icons';
import { go } from '../router';
import { useSyncState } from '../sync';

/** Nuvenzinha na barra: mostra se o caderno está sincronizado e leva aos ajustes. */
export function SyncBadge() {
  const s = useSyncState();
  const label = !s.email
    ? 'Sincronização desligada: clique para configurar'
    : s.status === 'sincronizando'
      ? 'Sincronizando…'
      : s.status === 'erro'
        ? `Erro na sincronização: ${s.message ?? ''}`
        : s.status === 'offline'
          ? 'Sem internet: as alterações sobem quando a conexão voltar'
          : s.pending
            ? `${s.pending} alteração(ões) para enviar`
            : 'Sincronizado com a nuvem';
  return (
    <button className={`icon-btn sync-badge ${s.email ? s.status : 'desligada'}`} onClick={() => go({ name: 'ajustes' })} title={label} aria-label={label}>
      <Icon name={s.email && s.status !== 'offline' ? 'cloud' : 'cloudOff'} />
    </button>
  );
}

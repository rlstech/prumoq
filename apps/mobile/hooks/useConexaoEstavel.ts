import { useStatus } from '@powersync/react';
import { useEffect, useState } from 'react';

/** Tempo desconectado antes de mostrar "Offline" (quedas curtas e reconexões não piscam na tela). */
const ATRASO_OFFLINE_MS = 6_000;
/** Tempo conectado antes de voltar a mostrar "online" (ao voltar a rede, as primeiras tentativas podem cair). */
const ATRASO_ONLINE_MS = 2_000;

/**
 * `connected` do PowerSync com histerese: ao voltar a internet o status alterna entre conectado e
 * desconectado algumas vezes até estabilizar. Para a interface, só vale a mudança que dura.
 */
export function useConexaoEstavel(): boolean {
  const { connected } = useStatus();
  const [estavel, setEstavel] = useState(connected);

  useEffect(() => {
    if (connected === estavel) return;
    const timer = setTimeout(() => setEstavel(connected), connected ? ATRASO_ONLINE_MS : ATRASO_OFFLINE_MS);
    return () => clearTimeout(timer);
  }, [connected, estavel]);

  return estavel;
}

import { useStatus } from '@powersync/react';
import { useEffect, useState } from 'react';

export type EstadoConexao = 'conectado' | 'conectando' | 'offline';

/** Com rede, quanto tempo sem conexão com o servidor ainda conta como "conectando" (cobre o intervalo de 20 s
 *  entre tentativas do PowerSync e a abertura do app). Depois disso vira "offline". */
const LIMITE_CONECTANDO_MS = 25_000;

// Compartilhado entre todas as telas: trocar de tela (e montar o indicador de novo) não reinicia a contagem.
let desconectadoDesde: number | null = Date.now();

function semRede(): boolean {
  return typeof navigator !== 'undefined' && navigator.onLine === false;
}

function calcular(connected: boolean): EstadoConexao {
  // Sem rede no aparelho vale mais que o PowerSync: o stream dele pode levar um tempo para perceber a queda.
  if (semRede()) return 'offline';
  if (connected) {
    desconectadoDesde = null;
    return 'conectado';
  }
  desconectadoDesde ??= Date.now();
  return Date.now() - desconectadoDesde < LIMITE_CONECTANDO_MS ? 'conectando' : 'offline';
}

/**
 * Estado da conexão para a interface. `connected` do PowerSync é falso enquanto o app abre e entre uma tentativa
 * e outra de reconexão; mostrar "Offline" nesses momentos assusta e é falso. Regras:
 * conectado na hora; sem rede no aparelho (navigator.onLine) offline na hora; com rede e ainda sem servidor,
 * "conectando" por até 25 s e só então offline.
 */
export function useConexaoEstavel(): EstadoConexao {
  const { connected } = useStatus();
  const [estado, setEstado] = useState<EstadoConexao>(() => calcular(connected));

  useEffect(() => {
    const atualizar = () => setEstado(calcular(connected));
    atualizar();
    // Reavalia quando a rede do aparelho muda e, desconectado, a cada segundo (de "conectando" para "offline").
    const timer = connected ? null : setInterval(atualizar, 1_000);
    window.addEventListener('online', atualizar);
    window.addEventListener('offline', atualizar);
    return () => {
      if (timer) clearInterval(timer);
      window.removeEventListener('online', atualizar);
      window.removeEventListener('offline', atualizar);
    };
  }, [connected]);

  return estado;
}

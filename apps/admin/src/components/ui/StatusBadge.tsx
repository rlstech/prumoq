type FvsStatus = 'aberta' | 'em_andamento' | 'conforme' | 'conforme_com_restricao' | 'nao_conforme' | 'inativada';
type NcStatus = 'aberta' | 'em_correcao' | 'resolvida' | 'cancelada' | 'encerrada_sem_resolucao';
type ObraStatus = 'nao_iniciada' | 'em_andamento' | 'paralisada' | 'concluida';
type Prioridade = 'Alta' | 'Média' | 'Baixa';

interface StatusBadgeProps {
  status: FvsStatus | NcStatus | ObraStatus | Prioridade;
  size?: 'sm' | 'md';
}

const tone = {
  neutral: 'bg-na-bg text-na',
  info: 'bg-pg-bg text-pg',
  ok: 'bg-ok-bg text-ok',
  warn: 'bg-warn-bg text-warn',
  nok: 'bg-nok-bg text-nok',
} as const;

const statusConfig: Record<string, { label: string; className: string }> = {
  // FVS
  'aberta': { label: 'Pendente', className: tone.neutral },
  'em_andamento': { label: 'Em andamento', className: tone.info },
  'conforme': { label: 'Conforme', className: tone.ok },
  'conforme_com_restricao': { label: 'Aprov. com restrição', className: tone.warn },
  'nao_conforme': { label: 'Não conforme', className: tone.nok },
  'inativada': { label: 'Inativada', className: tone.neutral },

  // NC
  'em_correcao': { label: 'Em correção', className: tone.warn },
  'resolvida': { label: 'Resolvida', className: tone.ok },
  'cancelada': { label: 'Cancelada', className: tone.neutral },
  'encerrada_sem_resolucao': { label: 'Encerrada sem resolução', className: tone.neutral },

  // Obra
  'nao_iniciada': { label: 'Não iniciada', className: tone.neutral },
  'paralisada': { label: 'Paralisada', className: tone.warn },
  'concluida': { label: 'Concluída', className: tone.ok },

  // Prioridade
  'Alta': { label: 'Alta', className: tone.nok },
  'Média': { label: 'Média', className: tone.warn },
  'Baixa': { label: 'Baixa', className: tone.info },
};

/** Etiqueta em pílula sem borda: fundo suave e texto na cor do estado. */
export default function StatusBadge({ status, size = 'sm' }: StatusBadgeProps) {
  const config = statusConfig[status] || { label: status, className: tone.neutral };
  const sizeClasses = size === 'sm' ? 'h-6 px-2.5 text-[11.5px]' : 'h-[30px] px-3 text-[13px]';

  return (
    <span className={`inline-flex items-center whitespace-nowrap rounded-full font-bold ${sizeClasses} ${config.className}`}>
      {config.label}
    </span>
  );
}

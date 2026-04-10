'use client';

type FvsStatus = 'aberta' | 'em_andamento' | 'conforme' | 'conforme_com_restricao' | 'nao_conforme' | 'inativada';
type NcStatus = 'aberta' | 'em_correcao' | 'resolvida' | 'cancelada';
type ObraStatus = 'nao_iniciada' | 'em_andamento' | 'paralisada' | 'concluida';
type Prioridade = 'Alta' | 'Média' | 'Baixa';

interface StatusBadgeProps {
  status: FvsStatus | NcStatus | ObraStatus | Prioridade;
  size?: 'sm' | 'md';
}

const statusConfig: Record<string, { label: string; className: string }> = {
  // FVS Status
  'aberta': { label: 'Pendente', className: 'bg-na-bg text-na border-na/20' },
  'em_andamento': { label: 'Em andamento', className: 'bg-pg-bg text-pg border-pg/20' },
  'conforme': { label: 'Conforme', className: 'bg-ok-bg text-ok border-ok/20' },
  'conforme_com_restricao': { label: 'Aprov. com Restrição', className: 'bg-warn-bg text-warn border-warn/20' },
  'nao_conforme': { label: 'Não Conforme', className: 'bg-nok-bg text-nok border-nok/20' },
  'inativada': { label: 'Inativada', className: 'bg-na-bg text-na border-na/20' },

  // NC Status
  'em_correcao': { label: 'Em correção', className: 'bg-warn-bg text-warn border-warn/20' },
  'resolvida': { label: 'Resolvida', className: 'bg-ok-bg text-ok border-ok/20' },
  'cancelada': { label: 'Cancelada', className: 'bg-na-bg text-na border-na/20' },

  // Obra Status
  'nao_iniciada': { label: 'Não Iniciada', className: 'bg-na-bg text-na border-na/20' },
  'paralisada': { label: 'Paralisada', className: 'bg-nok-bg text-nok border-nok/20' },
  'concluida': { label: 'Concluída', className: 'bg-ok-bg text-ok border-ok/20' },

  // Prioridade
  'Alta': { label: 'Alta', className: 'bg-nok-bg text-nok border-nok/20' },
  'Média': { label: 'Média', className: 'bg-warn-bg text-warn border-warn/20' },
  'Baixa': { label: 'Baixa', className: 'bg-pg-bg text-pg border-pg/20' },
};

export default function StatusBadge({ status, size = 'sm' }: StatusBadgeProps) {
  const config = statusConfig[status] || { label: status, className: 'bg-na-bg text-na border-na/20' };
  
  const sizeClasses = size === 'sm' ? 'px-2 py-0.5 text-[10px]' : 'px-3 py-1 text-xs';

  return (
    <span className={`inline-flex items-center rounded-full font-medium border ${sizeClasses} ${config.className}`}>
      {config.label}
    </span>
  );
}

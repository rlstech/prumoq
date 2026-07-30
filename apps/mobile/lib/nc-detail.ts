export interface NcLifecycleSource {
  created_at: string | null;
  resolvida_em: string | null;
  observacao_resolucao: string | null;
}

export interface NcReinspectionSource {
  id: string;
  created_at: string;
  resultado: string;
  observacao: string | null;
  inspetor_nome: string | null;
  numero_verif: number | null;
  foto_url: string | null;
  nova_nc_id: string | null;
}

export interface NcLifecycleEvent {
  id: string;
  kind: 'opened' | 'reinspection' | 'resolved';
  title: string;
  description: string | null;
  date: string | null;
  person: string | null;
  tone: 'danger' | 'warning' | 'success' | 'neutral';
  photoUrl: string | null;
  relatedNcId: string | null;
}

export function ncStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    aberta: 'Aberta',
    em_correcao: 'Em correção',
    resolvida: 'Resolvida',
    cancelada: 'Cancelada',
    encerrada_sem_resolucao: 'Encerrada sem resolução',
  };
  return labels[status] ?? status.replaceAll('_', ' ');
}

export function ncPriorityLabel(priority: string | null | undefined): string {
  const labels: Record<string, string> = {
    alta: 'Alta',
    media: 'Média',
    baixa: 'Baixa',
  };
  return labels[priority ?? ''] ?? 'Não informada';
}

export function reinspectionResultLabel(result: string): string {
  if (result === 'aprovada') return 'Reinspeção aprovada';
  if (result === 'reprovada') return 'Reinspeção reprovada';
  return 'Reinspeção registrada';
}

export function buildNcLifecycle(
  nc: NcLifecycleSource,
  reinspections: readonly NcReinspectionSource[],
): NcLifecycleEvent[] {
  const events: NcLifecycleEvent[] = [
    {
      id: 'opened',
      kind: 'opened',
      title: 'Não conformidade registrada',
      description: 'Ocorrência aberta a partir da verificação de serviço.',
      date: nc.created_at,
      person: null,
      tone: 'danger',
      photoUrl: null,
      relatedNcId: null,
    },
  ];

  [...reinspections]
    .sort((left, right) => Date.parse(left.created_at) - Date.parse(right.created_at))
    .forEach(reinspection => {
      const approved = reinspection.resultado === 'aprovada';
      events.push({
        id: reinspection.id,
        kind: 'reinspection',
        title: reinspectionResultLabel(reinspection.resultado),
        description: reinspection.observacao,
        date: reinspection.created_at,
        person: reinspection.inspetor_nome,
        tone: approved ? 'success' : 'warning',
        photoUrl: reinspection.foto_url,
        relatedNcId: reinspection.nova_nc_id,
      });
    });

  if (nc.resolvida_em) {
    events.push({
      id: 'resolved',
      kind: 'resolved',
      title: 'Ocorrência resolvida',
      description: nc.observacao_resolucao,
      date: nc.resolvida_em,
      person: null,
      tone: 'success',
      photoUrl: null,
      relatedNcId: null,
    });
  }

  return events;
}

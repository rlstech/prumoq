import Header from '@/components/layout/Header';
import { notFound } from '@/lib/compat/navigation';
import { createClient } from '@/lib/supabase/server';
import { money, num } from '../../format';
import ContractDetailClient from './ContractDetailClient';
import type { Amendment, HistoryEvent, ServiceRow } from './types';

export const dynamic = 'force-dynamic';

type Json = Record<string, unknown>;
const n = (v: unknown) => Number(v ?? 0);

export default async function ContractPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: contract } = await supabase.from('contratos').select('*').eq('id', id).maybeSingle();
  if (!contract) notFound();

  const [{ data: summary }, { data: works }, { data: teams }, { data: workTeams }, { data: measurements }, { data: links }, { data: amendmentsRaw }, { data: users }] = await Promise.all([
    supabase.from('vw_resumo_contratos').select('*').eq('contrato_id', id).maybeSingle(),
    supabase.from('obras').select('id,nome,controle_medicoes_efetivo').order('nome'),
    supabase.from('equipes').select('id,nome').order('nome'),
    supabase.from('obra_equipes').select('obra_id,equipe_id'),
    supabase.from('medicoes_servico').select('*').eq('contrato_id', id).order('data_medicao', { ascending: false }).order('created_at', { ascending: false }),
    supabase.from('vinculos_execucao_servico').select('*').eq('contrato_id', id).order('created_at'),
    supabase.from('contrato_aditivos').select('*').eq('contrato_id', id).order('numero', { ascending: false }),
    supabase.from('usuarios').select('id,nome'),
  ]);

  const measurementIds = (measurements ?? []).map(m => m.id);
  const linkIds = (links ?? []).map(l => l.id);
  const amendmentIds = (amendmentsRaw ?? []).map(a => a.id);
  const fvsIds = Array.from(new Set((links ?? []).map(l => l.fvs_planejada_id)));
  const [{ data: items }, { data: balances }, { data: advances }, { data: configs }, { data: amendmentItems }] = await Promise.all([
    measurementIds.length
      ? supabase.from('medicao_servico_itens').select('medicao_id,vinculacao_id,valor_calculado,tipo').in('medicao_id', measurementIds)
      : Promise.resolve({ data: [] }),
    linkIds.length ? supabase.from('vw_saldos_medicao_servico').select('*').in('vinculacao_id', linkIds) : Promise.resolve({ data: [] }),
    linkIds.length ? supabase.from('avancos_aprovados_servico').select('vinculacao_id,aprovado_atual').in('vinculacao_id', linkIds) : Promise.resolve({ data: [] }),
    fvsIds.length ? supabase.from('fvs_medicao_configuracoes').select('id,fvs_planejada_id,metodo,unidade,quantidade_total,preco_unitario').in('fvs_planejada_id', fvsIds) : Promise.resolve({ data: [] }),
    amendmentIds.length ? supabase.from('contrato_aditivo_itens').select('*').in('aditivo_id', amendmentIds) : Promise.resolve({ data: [] }),
  ]);
  const allFvsIds = Array.from(new Set([...fvsIds, ...(amendmentItems ?? []).map(i => i.fvs_planejada_id)]));
  const { data: fvs } = allFvsIds.length ? await supabase.from('fvs_planejadas').select('id,subservico,ambiente_id').in('id', allFvsIds) : { data: [] };
  const ambienteIds = Array.from(new Set((fvs ?? []).map(f => f.ambiente_id)));
  const configIds = (configs ?? []).map(c => c.id);
  const [{ data: ambientes }, { data: auditContract }, { data: auditConfigs }, { data: auditLinks }] = await Promise.all([
    ambienteIds.length ? supabase.from('ambientes').select('id,nome').in('id', ambienteIds) : Promise.resolve({ data: [] }),
    supabase.from('auditoria_operacional').select('*').eq('entidade', 'contrato').eq('entidade_id', id).order('created_at', { ascending: false }),
    configIds.length ? supabase.from('auditoria_operacional').select('*').eq('entidade', 'fvs_medicao_configuracao').in('entidade_id', configIds) : Promise.resolve({ data: [] }),
    linkIds.length ? supabase.from('auditoria_operacional').select('*').eq('entidade', 'vinculo_execucao').in('entidade_id', linkIds) : Promise.resolve({ data: [] }),
  ]);

  const userName = new Map((users ?? []).map(u => [u.id, u.nome]));
  const ambienteName = new Map((ambientes ?? []).map(a => [a.id, a.nome]));
  const fvsById = new Map((fvs ?? []).map(f => [f.id, f]));
  const serviceName = (fvsId: string) => {
    const f = fvsById.get(fvsId);
    return f ? `${ambienteName.get(f.ambiente_id) ? `${ambienteName.get(f.ambiente_id)} › ` : ''}${f.subservico ?? 'Serviço'}` : 'Serviço';
  };

  // Valor medido por vínculo: só medições aprovadas, com o preço do momento.
  const approved = new Set((measurements ?? []).filter(m => m.status === 'aprovada').map(m => m.id));
  const measuredValueByLink = new Map<string, number>();
  for (const i of items ?? []) {
    if (!approved.has(i.medicao_id)) continue;
    measuredValueByLink.set(i.vinculacao_id, (measuredValueByLink.get(i.vinculacao_id) ?? 0) + n(i.valor_calculado));
  }
  const approvedByLink = new Map<string, number>();
  for (const a of advances ?? []) approvedByLink.set(a.vinculacao_id, Math.max(approvedByLink.get(a.vinculacao_id) ?? 0, n(a.aprovado_atual)));

  const services = new Map<string, ServiceRow>();
  for (const link of links ?? []) {
    const f = fvsById.get(link.fvs_planejada_id);
    const cfg = (configs ?? []).find(c => c.fvs_planejada_id === link.fvs_planejada_id);
    const b = (balances ?? []).find(x => x.vinculacao_id === link.id);
    const active = link.status === 'ativo';
    const row = services.get(link.fvs_planejada_id) ?? {
      fvsId: link.fvs_planejada_id,
      ambienteId: f?.ambiente_id ?? '',
      ambiente: f ? ambienteName.get(f.ambiente_id) ?? '' : '',
      servico: f?.subservico ?? 'Serviço',
      unidade: cfg?.unidade ?? '',
      metodo: cfg?.metodo ?? 'quantidade',
      preco: cfg?.preco_unitario == null ? null : n(cfg.preco_unitario),
      previsto: 0, aprovado: 0, medido: 0, liberado: 0, bloqueado: 0, valorLiberado: 0, valorMedido: 0,
      minQuantidade: 0, podeMudarQuantidade: false,
    };
    const scope = active ? n(link.escopo_atribuido) : n(link.aprovado_congelado);
    row.previsto += scope;
    row.aprovado += n(b?.aprovado);
    row.medido += n(b?.medido);
    row.liberado += n(b?.disponivel);
    row.bloqueado += n(b?.bloqueado);
    row.valorLiberado += n(b?.valor_disponivel);
    row.valorMedido += measuredValueByLink.get(link.id) ?? 0;
    // Mínimo: o que não pode sair (tudo dos vínculos encerrados + o já aprovado no ativo).
    row.minQuantidade += active ? approvedByLink.get(link.id) ?? 0 : scope;
    if (active && row.metodo === 'quantidade') row.podeMudarQuantidade = true;
    services.set(link.fvs_planejada_id, row);
  }

  const amendments: Amendment[] = (amendmentsRaw ?? []).map(a => ({
    id: a.id,
    numero: a.numero,
    descricao: a.descricao,
    data: a.data,
    valorAnterior: n(a.valor_anterior),
    valorNovo: n(a.valor_novo),
    autor: a.criado_por ? userName.get(a.criado_por) ?? null : null,
    createdAt: a.created_at,
    itens: (amendmentItems ?? []).filter(i => i.aditivo_id === a.id).map(i => ({
      fvsId: i.fvs_planejada_id,
      servico: serviceName(i.fvs_planejada_id),
      tipo: i.tipo === 'inclusao' ? 'inclusao' : 'alteracao',
      unidade: i.unidade,
      quantidadeAnterior: n(i.quantidade_anterior),
      quantidadeNova: n(i.quantidade_nova),
      precoAnterior: i.preco_anterior == null ? null : n(i.preco_anterior),
      precoNovo: i.preco_novo == null ? null : n(i.preco_novo),
    })),
  }));

  // Linha do tempo: contrato, configuração dos serviços e trocas de empreiteiro.
  const configFvs = new Map((configs ?? []).map(c => [c.id, c.fvs_planejada_id]));
  const linkFvs = new Map((links ?? []).map(l => [l.id, l.fvs_planejada_id]));
  const events: HistoryEvent[] = [
    ...(auditContract ?? []).map(e => {
      const d = (e.dados ?? {}) as Json;
      const texto: Record<string, string> = {
        criado: 'Contrato criado',
        atualizado: 'Dados do contrato editados',
        encerrado: 'Contrato encerrado',
        reaberto: 'Contrato reaberto',
        aditivo: `Aditivo AD-${String(d.numero ?? '').padStart(2, '0')} registrado`,
      };
      const detalhe = e.acao === 'aditivo'
        ? `${money(n(d.valor_anterior))} → ${money(n(d.valor_novo))}`
        : e.acao === 'encerrado' && d.motivo ? String(d.motivo) : null;
      return { id: e.id, quando: e.created_at, autor: e.usuario_id ? userName.get(e.usuario_id) ?? null : null, texto: texto[e.acao] ?? e.acao, detalhe };
    }),
    ...(auditConfigs ?? []).map(e => {
      const d = (e.dados ?? {}) as Json;
      const servico = serviceName(configFvs.get(e.entidade_id) ?? '');
      if (e.acao === 'alterada_fora_de_aditivo') {
        return {
          id: e.id, quando: e.created_at, autor: e.usuario_id ? userName.get(e.usuario_id) ?? null : null,
          texto: `${servico}: quantidade ou preço alterado fora de aditivo`,
          detalhe: `qtd ${num(n(d.quantidade_anterior))} → ${num(n(d.quantidade_nova))} · preço ${money(n(d.preco_anterior))} → ${money(n(d.preco_novo))}`,
        };
      }
      return { id: e.id, quando: e.created_at, autor: e.usuario_id ? userName.get(e.usuario_id) ?? null : null, texto: `${servico}: medição configurada`, detalhe: d.total != null ? `quantidade ${num(n(d.total))}` : null };
    }),
    ...(auditLinks ?? []).map(e => ({
      id: e.id, quando: e.created_at, autor: e.usuario_id ? userName.get(e.usuario_id) ?? null : null,
      texto: `${serviceName(linkFvs.get(e.entidade_id) ?? '')}: ${e.acao === 'empreiteiro_trocado' ? 'empreiteiro trocado' : e.acao}`,
      detalhe: ((e.dados ?? {}) as Json).motivo ? String(((e.dados ?? {}) as Json).motivo) : null,
    })),
  ].sort((a, b) => b.quando.localeCompare(a.quando));

  const obraNome = (works ?? []).find(w => w.id === contract.obra_id)?.nome ?? '';
  const equipeNome = (teams ?? []).find(t => t.id === contract.equipe_id)?.nome ?? '';

  return (
    <>
      <Header breadcrumbs={[{ label: 'Contratos e medições', href: '/medicoes' }, { label: contract.numero }]} />
      <main className="prumo-page">
        <div className="prumo-page-inner">
          <ContractDetailClient
            contract={contract}
            summary={summary}
            obraNome={obraNome}
            equipeNome={equipeNome}
            measurements={measurements ?? []}
            itemTotals={items ?? []}
            services={Array.from(services.values()).sort((a, b) => a.ambiente.localeCompare(b.ambiente, 'pt-BR') || a.servico.localeCompare(b.servico, 'pt-BR'))}
            amendments={amendments}
            events={events}
            createdBy={contract.criado_por ? userName.get(contract.criado_por) ?? null : null}
            updatedBy={contract.updated_by ? userName.get(contract.updated_by) ?? null : null}
            works={works ?? []}
            teams={teams ?? []}
            workTeams={workTeams ?? []}
          />
        </div>
      </main>
    </>
  );
}

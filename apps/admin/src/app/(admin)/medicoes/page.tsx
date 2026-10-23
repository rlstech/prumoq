import Header from '@/components/layout/Header';
import PageHeader from '@/components/layout/PageHeader';
import { createClient } from '@/lib/supabase/server';
import MeasurementsClient from './MeasurementsClient';

export const dynamic='force-dynamic';
export default async function MeasurementsPage(){const supabase=await createClient();const[{data:works},{data:indicators},{data:measurements},{data:teams},{data:workTeams},{data:items},{data:balances},{data:plannedServices},{data:pendingImpacts}]=await Promise.all([
 supabase.from('obras').select('id,nome,controle_medicoes_efetivo').eq('controle_medicoes_efetivo',true).order('nome'),
 supabase.from('vw_indicadores_medicoes').select('*'),
 supabase.from('medicoes_servico').select('*').order('data_medicao',{ascending:false}),
 supabase.from('equipes').select('id,nome,tipo').eq('ativo',true).order('nome'),
 supabase.from('obra_equipes').select('obra_id,equipe_id'),
 supabase.from('medicao_servico_itens').select('medicao_id,valor_calculado,quantidade_periodo,tipo'),
 supabase.from('vw_saldos_medicao_servico').select('*'),
 supabase.from('fvs_planejadas').select('id,subservico'),
 supabase.from('nao_conformidades').select('id,descricao,prazo_avaliacao').eq('situacao_financeira','em_avaliacao').in('status',['aberta','em_correcao']).order('prazo_avaliacao'),
]);return <><Header breadcrumbs={[{label:'Medições'}]}/><main className="prumo-page"><div className="prumo-page-inner"><PageHeader title="Medições" description="Avanço físico apurado a partir das FVS conformes. A aprovação libera o valor do serviço no saldo do contrato." /><MeasurementsClient works={works??[]} indicators={indicators??[]} measurements={measurements??[]} teams={teams??[]} workTeams={workTeams??[]} itemTotals={items??[]} balances={balances??[]} plannedServices={plannedServices??[]} pendingImpacts={pendingImpacts??[]}/></div></main></>}

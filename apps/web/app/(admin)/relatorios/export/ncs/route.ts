import { createClient } from '@/lib/supabase/server';
import { spreadsheetResponse } from '@/lib/reports/spreadsheet';
import type { Database } from '@prumoq/shared';

export const dynamic = 'force-dynamic';

type NcRow = Database['public']['Functions']['get_ncs_full']['Returns'][number];

function localDate(value: string | null) {
  if (!value) return '';
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
  }).format(new Date(`${value}T12:00:00-03:00`));
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const obraId = searchParams.get('obraId');
  const from = searchParams.get('from');
  const to = searchParams.get('to');

  const supabase = await createClient();
  const { data, error } = await supabase.rpc('get_ncs_full');
  if (error) {
    console.error('Erro ao exportar NCs:', error);
    return Response.json(
      { error: 'Não foi possível exportar as não conformidades.' },
      { status: 500 },
    );
  }

  const rows = ((data ?? []) as NcRow[]).filter(
    (row) =>
      (!obraId || row.obra_id === obraId) &&
      (!from || !row.prazo_correcao || row.prazo_correcao >= from) &&
      (!to || !row.prazo_correcao || row.prazo_correcao <= to),
  );

  return spreadsheetResponse(
    'nao-conformidades.xls',
    'Não conformidades',
    [
      { header: 'Obra', value: (row) => row.obra_nome },
      { header: 'Ambiente', value: (row) => row.ambiente_nome },
      { header: 'Item', value: (row) => row.item_titulo },
      { header: 'Descrição', value: (row) => row.descricao },
      { header: 'Responsável', value: (row) => row.responsavel_nome },
      { header: 'Prioridade', value: (row) => row.prioridade },
      { header: 'Status', value: (row) => row.status },
      { header: 'Prazo de correção', value: (row) => localDate(row.prazo_correcao) },
    ],
    rows,
  );
}

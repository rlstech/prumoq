import { createClient } from '@/lib/supabase/server';
import { spreadsheetResponse } from '@/lib/reports/spreadsheet';
import type { Database } from '@prumoq/shared';

export const dynamic = 'force-dynamic';

type ProgressRow =
  Database['public']['Functions']['get_obras_com_fvs']['Returns'][number];

export async function GET(request: Request) {
  const obraId = new URL(request.url).searchParams.get('obraId');
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('get_obras_com_fvs');

  if (error) {
    console.error('Erro ao exportar progresso:', error);
    return Response.json(
      { error: 'Não foi possível exportar o progresso das obras.' },
      { status: 500 },
    );
  }

  const rows = ((data ?? []) as ProgressRow[]).filter(
    (row) => !obraId || row.id === obraId,
  );
  return spreadsheetResponse(
    'progresso-obras.xls',
    'Progresso de obras',
    [
      { header: 'Obra', value: (row) => row.nome },
      { header: 'Empresa', value: (row) => row.empresa_nome },
      { header: 'Município', value: (row) => row.municipio },
      { header: 'UF', value: (row) => row.uf },
      { header: 'Status', value: (row) => row.status },
      { header: 'Ambientes', value: (row) => row.total_ambientes },
      { header: 'FVS totais', value: (row) => row.total_fvs },
      { header: 'FVS concluídas', value: (row) => row.fvs_concluidas },
      {
        header: 'Progresso (%)',
        value: (row) => Math.round((row.progresso_percentual ?? 0) * 100) / 100,
      },
      { header: 'NCs abertas', value: (row) => row.ncs_abertas },
    ],
    rows,
  );
}

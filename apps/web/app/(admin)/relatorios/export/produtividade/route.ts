import { createClient } from '@/lib/supabase/server';
import { spreadsheetResponse } from '@/lib/reports/spreadsheet';

export const dynamic = 'force-dynamic';

interface ProductivityRow {
  equipe: string;
  verificacoes: number;
  conformes: number;
  percentualMedio: number;
  obras: number;
}

interface VerificationSource {
  id: string;
  data_verif: string;
  status: string;
  percentual_exec: number;
  equipe_id: string | null;
  fvs_planejada_id: string;
}

interface FvsSource {
  id: string;
  ambiente_id: string;
}

interface AmbienteSource {
  id: string;
  obra_id: string;
}

interface EquipeSource {
  id: string;
  nome: string;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const obraId = searchParams.get('obraId');
  const from = searchParams.get('from');
  const to = searchParams.get('to');
  const supabase = await createClient();

  let verificationQuery = supabase
    .from('verificacoes')
    .select('id, data_verif, status, percentual_exec, equipe_id, fvs_planejada_id')
    .not('equipe_id', 'is', null);
  if (from) verificationQuery = verificationQuery.gte('data_verif', from);
  if (to) verificationQuery = verificationQuery.lte('data_verif', to);

  const { data: verifications, error: verificationError } =
    await verificationQuery;
  if (verificationError) {
    console.error('Erro ao exportar produtividade:', verificationError);
    return Response.json(
      { error: 'Não foi possível exportar a produtividade.' },
      { status: 500 },
    );
  }

  const verificationRows = (verifications ?? []) as VerificationSource[];
  const fvsIds = Array.from(
    new Set(verificationRows.map((row) => row.fvs_planejada_id)),
  );
  const { data: fvsRows, error: fvsError } = fvsIds.length
    ? await supabase
        .from('fvs_planejadas')
        .select('id, ambiente_id')
        .in('id', fvsIds)
    : { data: [], error: null };
  if (fvsError) throw fvsError;

  const typedFvsRows = (fvsRows ?? []) as FvsSource[];
  const ambienteIds = Array.from(
    new Set(typedFvsRows.map((row) => row.ambiente_id)),
  );
  const { data: ambientes, error: ambientesError } = ambienteIds.length
    ? await supabase
        .from('ambientes')
        .select('id, obra_id')
        .in('id', ambienteIds)
    : { data: [], error: null };
  if (ambientesError) throw ambientesError;

  const equipeIds = Array.from(
    new Set(
      verificationRows
        .map((row) => row.equipe_id)
        .filter((id): id is string => Boolean(id)),
    ),
  );
  const { data: equipes, error: equipesError } = equipeIds.length
    ? await supabase.from('equipes').select('id, nome').in('id', equipeIds)
    : { data: [], error: null };
  if (equipesError) throw equipesError;

  const obraByAmbiente = new Map(
    ((ambientes ?? []) as AmbienteSource[]).map((ambiente) => [
      ambiente.id,
      ambiente.obra_id,
    ]),
  );
  const obraByFvs = new Map(
    typedFvsRows.map((fvs) => [
      fvs.id,
      obraByAmbiente.get(fvs.ambiente_id),
    ]),
  );
  const equipeNames = new Map(
    ((equipes ?? []) as EquipeSource[]).map((equipe) => [
      equipe.id,
      equipe.nome,
    ]),
  );
  const totals = new Map<
    string,
    { verificacoes: number; conformes: number; percentual: number; obras: Set<string> }
  >();

  for (const verification of verificationRows) {
    if (!verification.equipe_id) continue;
    const verificationObraId = obraByFvs.get(verification.fvs_planejada_id);
    if (obraId && verificationObraId !== obraId) continue;
    const total = totals.get(verification.equipe_id) ?? {
      verificacoes: 0,
      conformes: 0,
      percentual: 0,
      obras: new Set<string>(),
    };
    total.verificacoes += 1;
    total.percentual += verification.percentual_exec;
    if (
      ['conforme', 'concluida', 'concluida_ressalva'].includes(
        verification.status,
      )
    ) {
      total.conformes += 1;
    }
    if (verificationObraId) total.obras.add(verificationObraId);
    totals.set(verification.equipe_id, total);
  }

  const rows: ProductivityRow[] = Array.from(totals.entries())
    .map(([equipeId, total]) => ({
      equipe: equipeNames.get(equipeId) ?? 'Equipe não identificada',
      verificacoes: total.verificacoes,
      conformes: total.conformes,
      percentualMedio: Math.round(total.percentual / total.verificacoes),
      obras: total.obras.size,
    }))
    .sort((a, b) => a.equipe.localeCompare(b.equipe, 'pt-BR'));

  return spreadsheetResponse(
    'produtividade-equipes.xls',
    'Produtividade',
    [
      { header: 'Equipe', value: (row) => row.equipe },
      { header: 'Verificações', value: (row) => row.verificacoes },
      { header: 'Conformes', value: (row) => row.conformes },
      { header: 'Execução média (%)', value: (row) => row.percentualMedio },
      { header: 'Obras atendidas', value: (row) => row.obras },
    ],
    rows,
  );
}

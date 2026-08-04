/**
 * Seed de ambientes + FVS planejadas para o cliente RVIX.
 *
 * Uso:
 *   node scripts/seed-rvix-ambientes-fvs.mjs            # executa o seed
 *   node scripts/seed-rvix-ambientes-fvs.mjs --rollback # remove tudo que o seed criou
 *
 * Regras:
 *   - 4 a 8 ambientes aleatórios por obra ativa do cliente (soma aos existentes)
 *   - 3 a 5 FVS planejadas aleatórias por ambiente novo (sem repetição no ambiente)
 *   - Nomes realistas por tipo (interno/externo), sem colisão com nomes existentes
 *   - Todos os registros marcados com observacoes = '[SEED-RVIX]' p/ auditoria/rollback
 */

import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

config({ path: 'apps/web/.env.local' });

const RVIX_CLIENTE_ID = '9f22acfa-f4a9-43bc-8c54-9c60a0a7cb2c';
const SEED_TAG = '[SEED-RVIX]';

const POOL_INTERNO = [
  'SALA', 'QUARTO', 'COZINHA', 'BANHEIRO', 'CORREDOR', 'HALL',
  'ESCRITÓRIO', 'SALA DE REUNIÃO', 'SALA TÉCNICA', 'DEPÓSITO',
  'LAVANDERIA', 'ÁREA DE SERVIÇO', 'SALA DE ESTAR', 'DORMITÓRIO',
  'SALA DE JANTAR', 'ESCADA',
];

const POOL_EXTERNO = [
  'ÁREA EXTERNA', 'RAMPA', 'ACESSO', 'PÁTIO', 'JARDIM',
  'ESTACIONAMENTO', 'ÁREA DE CARGA', 'FACHADA', 'COBERTURA',
  'PÓRTICO', 'GUARITA',
];

const POOL_LOCALIZACAO = [
  'Térreo', 'Pavimento 1', 'Pavimento 2', 'Pavimento 3',
  'Bloco A', 'Bloco B', 'Área externa', null,
];

const rand = (min, max) => min + Math.floor(Math.random() * (max - min + 1));

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Gera `count` nomes únicos para a obra, evitando os já existentes.
 * Formato: "BASE NN" (contador por base, começando em 01).
 */
function gerarNomesAmbientes(count, nomesExistentes) {
  const usados = new Set(nomesExistentes);
  const contadores = {};
  const resultado = [];

  while (resultado.length < count) {
    const usarInterno = Math.random() < 0.5;
    const pool = usarInterno ? POOL_INTERNO : POOL_EXTERNO;
    const base = pool[Math.floor(Math.random() * pool.length)];
    contadores[base] = (contadores[base] || 0) + 1;
    const nome = `${base} ${String(contadores[base]).padStart(2, '0')}`;
    if (usados.has(nome)) continue; // contador avança na próxima tentativa
    usados.add(nome);
    resultado.push({ nome, tipo: usarInterno ? 'interno' : 'externo' });
  }
  return resultado;
}

async function main() {
  const rollback = process.argv.includes('--rollback');

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error('FATAL: NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY ausentes em apps/web/.env.local');
    process.exit(1);
  }
  const supabase = createClient(url, key, { auth: { persistSession: false } });

  if (rollback) {
    console.log(`Removendo registros ${SEED_TAG} do cliente RVIX...`);
    const { data: seeded, error: findErr } = await supabase
      .from('ambientes')
      .select('id')
      .eq('cliente_id', RVIX_CLIENTE_ID)
      .like('observacoes', `%${SEED_TAG}%`);
    if (findErr) throw findErr;
    const ids = (seeded ?? []).map(a => a.id);
    if (!ids.length) {
      console.log('Nada a remover (nenhum ambiente com a tag encontrado).');
      return;
    }
    // fvs_planejadas tem ON DELETE CASCADE de ambientes — remover ambientes basta,
    // mas removemos explicitamente primeiro por segurança/visibilidade de log.
    const { error: fvsErr } = await supabase
      .from('fvs_planejadas')
      .delete()
      .in('ambiente_id', ids);
    if (fvsErr) throw fvsErr;
    const { error: ambErr } = await supabase
      .from('ambientes')
      .delete()
      .in('id', ids);
    if (ambErr) throw ambErr;
    console.log(`Rollback concluído: ${ids.length} ambiente(s) removido(s) (FVS em cascata).`);
    return;
  }

  // ── 1. Obras ativas do cliente ──────────────────────────────
  const { data: obras, error: obrasErr } = await supabase
    .from('obras')
    .select('id, nome')
    .eq('cliente_id', RVIX_CLIENTE_ID)
    .eq('ativo', true)
    .order('nome');
  if (obrasErr) throw obrasErr;
  if (!obras?.length) {
    console.error('Nenhuma obra ativa encontrada para o cliente RVIX.');
    process.exit(1);
  }

  // ── 2. FVS Padrão ativos do cliente ─────────────────────────
  const { data: fvsPadrao, error: fvsErr } = await supabase
    .from('fvs_padrao')
    .select('id, nome, revisao_atual')
    .eq('cliente_id', RVIX_CLIENTE_ID)
    .eq('ativo', true);
  if (fvsErr) throw fvsErr;
  if (!fvsPadrao?.length) {
    console.error('Nenhuma FVS Padrão ativa encontrada para o cliente RVIX.');
    process.exit(1);
  }

  console.log(`Obras: ${obras.length} | FVS Padrão disponíveis: ${fvsPadrao.length}\n`);

  let totalAmbientes = 0;
  let totalFvs = 0;

  for (const obra of obras) {
    // Nomes já existentes nesta obra (evita colisão)
    const { data: existentes, error: existErr } = await supabase
      .from('ambientes')
      .select('nome')
      .eq('obra_id', obra.id);
    if (existErr) throw existErr;
    const nomesExistentes = (existentes ?? []).map(a => a.nome);

    const qtdAmbientes = rand(4, 8);
    const novos = gerarNomesAmbientes(qtdAmbientes, nomesExistentes);

    // Insere ambientes (sequencial — precisamos do id retornado)
    const criados = [];
    for (const amb of novos) {
      const { data, error } = await supabase
        .from('ambientes')
        .insert({
          cliente_id: RVIX_CLIENTE_ID,
          obra_id: obra.id,
          nome: amb.nome,
          tipo: amb.tipo,
          localizacao: POOL_LOCALIZACAO[Math.floor(Math.random() * POOL_LOCALIZACAO.length)],
          observacoes: SEED_TAG,
          ativo: true,
        })
        .select('id, nome')
        .single();
      if (error) throw new Error(`[${obra.nome}] falha ao criar ambiente "${amb.nome}": ${error.message}`);
      criados.push(data);
    }

    // Vincula 3-5 FVS por ambiente (sem repetição dentro do ambiente)
    let fvsNaObra = 0;
    for (const amb of criados) {
      const qtdFvs = rand(3, 5);
      const sorteadas = shuffle(fvsPadrao).slice(0, qtdFvs);
      const rows = sorteadas.map(f => ({
        cliente_id: RVIX_CLIENTE_ID,
        ambiente_id: amb.id,
        fvs_padrao_id: f.id,
        revisao_associada: f.revisao_atual,
        subservico: f.nome,
        status: 'pendente',
      }));
      const { error } = await supabase.from('fvs_planejadas').insert(rows);
      if (error) throw new Error(`[${obra.nome}] falha ao vincular FVS em "${amb.nome}": ${error.message}`);
      fvsNaObra += qtdFvs;
    }

    totalAmbientes += criados.length;
    totalFvs += fvsNaObra;
    console.log(`${obra.nome}: ${criados.length} ambiente(s), ${fvsNaObra} FVS planejada(s)`);
    console.log(`  → ${criados.map(a => a.nome).join(', ')}`);
  }

  console.log(`\n✓ Seed concluído: ${totalAmbientes} ambiente(s) + ${totalFvs} FVS planejada(s) em ${obras.length} obra(s).`);
  console.log(`  Rollback: node scripts/seed-rvix-ambientes-fvs.mjs --rollback`);
}

main().catch(err => {
  console.error('FATAL:', err.message);
  process.exit(1);
});

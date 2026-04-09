# PrumoQ — Regras de Sincronização (PowerSync)

## Visão Geral

O app mobile usa **PowerSync** para manter um banco SQLite local no dispositivo.
PowerSync se conecta ao Supabase e sincroniza dados automaticamente.

- **Online:** dados sincronizados em tempo real
- **Offline:** leituras e escritas funcionam localmente
- **Reconexão:** sync automático da fila de operações pendentes

---

## Configuração PowerSync

### Credenciais
```typescript
// lib/powersync.ts
import { PowerSyncDatabase } from '@powersync/react-native';
import { SupabaseConnector } from './supabase-connector';

export const db = new PowerSyncDatabase({
  schema: AppSchema,
  database: { dbFilename: 'prumoq.db' },
});

// Conectar após login
await db.connect(new SupabaseConnector());
```

### Connector Supabase
```typescript
// lib/supabase-connector.ts
import { AbstractPowerSyncDatabase, CrudEntry, PowerSyncBackendConnector } from '@powersync/react-native';
import { supabase } from './supabase';

export class SupabaseConnector implements PowerSyncBackendConnector {
  async fetchCredentials() {
    const { data: { session } } = await supabase.auth.getSession();
    return {
      endpoint: process.env.EXPO_PUBLIC_POWERSYNC_URL!,
      token: session?.access_token ?? '',
    };
  }

  async uploadData(database: AbstractPowerSyncDatabase) {
    const transaction = await database.getNextCrudTransaction();
    if (!transaction) return;

    try {
      for (const op of transaction.crud) {
        await this.processCrudOperation(op);
      }
      await transaction.complete();
    } catch (error) {
      console.error('Sync upload error:', error);
      throw error; // PowerSync vai retentar
    }
  }

  private async processCrudOperation(op: CrudEntry) {
    const table = op.table;
    const data = op.opData;

    switch (op.op) {
      case 'PUT':
        await supabase.from(table).upsert(data);
        break;
      case 'PATCH':
        await supabase.from(table).update(data).eq('id', op.id);
        break;
      case 'DELETE':
        await supabase.from(table).delete().eq('id', op.id);
        break;
    }
  }
}
```

---

## Schema PowerSync (SQLite local)

```typescript
// lib/schema.ts
import { column, Schema, Table } from '@powersync/react-native';

const obras = new Table({
  empresa_id:        column.text,
  nome:              column.text,
  eng_responsavel:   column.text,
  crea_cau:          column.text,
  status:            column.text,
  municipio:         column.text,
  uf:                column.text,
  data_inicio_prev:  column.text,
  data_termino_prev: column.text,
  ativo:             column.integer,
  updated_at:        column.text,
});

const obra_usuarios = new Table({
  obra_id:    column.text,
  usuario_id: column.text,
  papel:      column.text,
  ativo:      column.integer,
});

const ambientes = new Table({
  obra_id:     column.text,
  nome:        column.text,
  tipo:        column.text,
  localizacao: column.text,
  ativo:       column.integer,
  updated_at:  column.text,
});

const fvs_padrao = new Table({
  empresa_id:    column.text,
  nome:          column.text,
  descricao:     column.text,
  categoria:     column.text,
  norma_ref:     column.text,
  revisao_atual: column.integer,
  ativo:         column.integer,
  updated_at:    column.text,
});

const fvs_padrao_itens = new Table({
  fvs_padrao_id: column.text,
  revisao:       column.integer,
  ordem:         column.integer,
  titulo:        column.text,
  metodo_verif:  column.text,
  tolerancia:    column.text,
});

const fvs_planejadas = new Table({
  ambiente_id:       column.text,
  fvs_padrao_id:     column.text,
  revisao_associada: column.integer,
  subservico:        column.text,
  status:            column.text,
  concluida_em:      column.text,
  updated_at:        column.text,
});

const verificacoes = new Table({
  fvs_planejada_id: column.text,
  numero_verif:     column.integer,
  inspetor_id:      column.text,
  equipe_id:        column.text,
  data_verif:       column.text,
  percentual_exec:  column.integer,
  status:           column.text,
  observacoes:      column.text,
  assinatura_url:   column.text,
  assinada_em:      column.text,
  created_offline:  column.integer,
  updated_at:       column.text,
}, { indexes: { fvs_planejada: ['fvs_planejada_id'] } });

const verificacao_itens = new Table({
  verificacao_id:     column.text,
  fvs_padrao_item_id: column.text,
  ordem:              column.integer,
  titulo:             column.text,
  metodo_verif:       column.text,
  tolerancia:         column.text,
  resultado:          column.text,
});

const verificacao_fotos = new Table({
  verificacao_id: column.text,
  r2_key:         column.text,
  r2_thumb_key:   column.text,
  nome_arquivo:   column.text,
  tamanho_bytes:  column.integer,
  mime_type:      column.text,
  ordem:          column.integer,
});

const nao_conformidades = new Table({
  verificacao_id:        column.text,
  verificacao_item_id:   column.text,
  descricao:             column.text,
  solucao_proposta:      column.text,
  responsavel_id:        column.text,
  data_nova_verif:       column.text,
  prioridade:            column.text,
  status:                column.text,
  resolvida_na_verif_id: column.text,
  resolvida_em:          column.text,
  updated_at:            column.text,
});

const nc_fotos = new Table({
  nc_id:          column.text,
  r2_key:         column.text,
  r2_thumb_key:   column.text,
  ordem:          column.integer,
});

const equipes = new Table({
  empresa_id:    column.text,
  nome:          column.text,
  tipo:          column.text,
  responsavel:   column.text,
  especialidade: column.text,
  ativo:         column.integer,
});

const usuarios = new Table({
  empresa_id: column.text,
  nome:       column.text,
  cargo:      column.text,
  perfil:     column.text,
  avatar_url: column.text,
});

export const AppSchema = new Schema({
  obras,
  obra_usuarios,
  ambientes,
  fvs_padrao,
  fvs_padrao_itens,
  fvs_planejadas,
  verificacoes,
  verificacao_itens,
  verificacao_fotos,
  nao_conformidades,
  nc_fotos,
  equipes,
  usuarios,
});
```

---

## Regras de Sync por Tabela

### PowerSync Sync Rules (YAML — configurar no PowerSync Dashboard)

```yaml
# powersync.yaml
bucket_definitions:
  # Obras acessíveis pelo inspetor logado
  obras_do_inspetor:
    parameters:
      - name: usuario_id
        value: token_parameters.user_id
    data:
      - table: obras
        where: >
          id IN (
            SELECT obra_id FROM obra_usuarios
            WHERE usuario_id = :usuario_id AND ativo = true
          )

  # Ambientes das obras acessíveis
  ambientes_das_obras:
    parameters:
      - name: usuario_id
        value: token_parameters.user_id
    data:
      - table: ambientes
        where: >
          obra_id IN (
            SELECT obra_id FROM obra_usuarios
            WHERE usuario_id = :usuario_id AND ativo = true
          )

  # FVS planejadas dos ambientes das obras acessíveis
  fvs_das_obras:
    parameters:
      - name: usuario_id
        value: token_parameters.user_id
    data:
      - table: fvs_planejadas
        where: >
          ambiente_id IN (
            SELECT a.id FROM ambientes a
            JOIN obra_usuarios ou ON a.obra_id = ou.obra_id
            WHERE ou.usuario_id = :usuario_id AND ou.ativo = true
          )

  # Verificações do inspetor
  verificacoes_do_inspetor:
    parameters:
      - name: usuario_id
        value: token_parameters.user_id
    data:
      - table: verificacoes
        where: inspetor_id = :usuario_id

  # Verificações de todas as obras acessíveis (para visualização)
  verificacoes_das_obras:
    parameters:
      - name: usuario_id
        value: token_parameters.user_id
    data:
      - table: verificacoes
        where: >
          fvs_planejada_id IN (
            SELECT fp.id FROM fvs_planejadas fp
            JOIN ambientes a ON fp.ambiente_id = a.id
            JOIN obra_usuarios ou ON a.obra_id = ou.obra_id
            WHERE ou.usuario_id = :usuario_id AND ou.ativo = true
          )

  # Itens e fotos das verificações
  itens_e_fotos:
    parameters:
      - name: usuario_id
        value: token_parameters.user_id
    data:
      - table: verificacao_itens
        where: >
          verificacao_id IN (
            SELECT v.id FROM verificacoes v
            JOIN fvs_planejadas fp ON v.fvs_planejada_id = fp.id
            JOIN ambientes a ON fp.ambiente_id = a.id
            JOIN obra_usuarios ou ON a.obra_id = ou.obra_id
            WHERE ou.usuario_id = :usuario_id AND ou.ativo = true
          )
      - table: verificacao_fotos
        where: >
          verificacao_id IN (
            SELECT v.id FROM verificacoes v
            JOIN fvs_planejadas fp ON v.fvs_planejada_id = fp.id
            JOIN ambientes a ON fp.ambiente_id = a.id
            JOIN obra_usuarios ou ON a.obra_id = ou.obra_id
            WHERE ou.usuario_id = :usuario_id AND ou.ativo = true
          )

  # NCs das obras acessíveis
  nc_das_obras:
    parameters:
      - name: usuario_id
        value: token_parameters.user_id
    data:
      - table: nao_conformidades
        where: >
          verificacao_id IN (
            SELECT v.id FROM verificacoes v
            JOIN fvs_planejadas fp ON v.fvs_planejada_id = fp.id
            JOIN ambientes a ON fp.ambiente_id = a.id
            JOIN obra_usuarios ou ON a.obra_id = ou.obra_id
            WHERE ou.usuario_id = :usuario_id AND ou.ativo = true
          )
      - table: nc_fotos
        where: >
          nc_id IN (
            SELECT nc.id FROM nao_conformidades nc
            JOIN verificacoes v ON nc.verificacao_id = v.id
            JOIN fvs_planejadas fp ON v.fvs_planejada_id = fp.id
            JOIN ambientes a ON fp.ambiente_id = a.id
            JOIN obra_usuarios ou ON a.obra_id = ou.obra_id
            WHERE ou.usuario_id = :usuario_id AND ou.ativo = true
          )

  # FVS padrão da empresa do inspetor
  fvs_padrao_da_empresa:
    parameters:
      - name: usuario_id
        value: token_parameters.user_id
    data:
      - table: fvs_padrao
        where: >
          empresa_id = (
            SELECT empresa_id FROM usuarios WHERE id = :usuario_id
          )
      - table: fvs_padrao_itens
        where: >
          fvs_padrao_id IN (
            SELECT id FROM fvs_padrao
            WHERE empresa_id = (
              SELECT empresa_id FROM usuarios WHERE id = :usuario_id
            )
          )
      - table: fvs_padrao_revisoes
        where: >
          fvs_padrao_id IN (
            SELECT id FROM fvs_padrao
            WHERE empresa_id = (
              SELECT empresa_id FROM usuarios WHERE id = :usuario_id
            )
          )

  # Equipes da empresa
  equipes_da_empresa:
    parameters:
      - name: usuario_id
        value: token_parameters.user_id
    data:
      - table: equipes
        where: >
          empresa_id = (
            SELECT empresa_id FROM usuarios WHERE id = :usuario_id
          )

  # Membros da obra (para exibir nomes de outros inspetores)
  obra_usuarios_membros:
    parameters:
      - name: usuario_id
        value: token_parameters.user_id
    data:
      - table: obra_usuarios
        where: >
          obra_id IN (
            SELECT obra_id FROM obra_usuarios
            WHERE usuario_id = :usuario_id AND ativo = true
          )

  # Dados de usuários das obras acessíveis
  usuarios_das_obras:
    parameters:
      - name: usuario_id
        value: token_parameters.user_id
    data:
      - table: usuarios
        where: >
          id IN (
            SELECT ou.usuario_id FROM obra_usuarios ou
            WHERE ou.obra_id IN (
              SELECT obra_id FROM obra_usuarios
              WHERE usuario_id = :usuario_id AND ativo = true
            )
          )
```

---

## Estratégia de Resolução de Conflitos

### Last-Write-Wins (padrão)
Para a maioria dos registros, a última escrita vence.
Isso é aceitável porque:
- Inspetores não editam verificações alheias (RLS garante)
- Verificações são imutáveis após assinatura
- Conflitos reais são raros (um inspetor por obra geralmente)

### Exceções (merge manual)
| Situação | Estratégia |
|---|---|
| NC criada offline, status mudou online | Manter status mais recente + registrar log |
| Foto pendente de upload, verificação deletada | Cancelar upload, limpar fila |
| Dois inspetores na mesma obra, mesmo ambiente | Não conflita (verificações são por inspetor) |

---

## Upload de Fotos (Offline Queue)

### Fluxo completo

```
Offline:
  1. Foto capturada → salva em expo-file-system como JPEG
  2. UUID gerado: photo_[uuid].jpg
  3. verificacao_fotos inserida com r2_key = 'pending:[local_path]'
  4. nc_fotos inserida com r2_key = 'pending:[local_path]' (se NC)

PowerSync sync event (conexão restaurada):
  5. uploadData() chamado
  6. Para registros com r2_key iniciando em 'pending:':
     a. Ler arquivo local
     b. Solicitar presigned URL ao Supabase Edge Function
     c. Upload direto para R2 via PUT
     d. Atualizar r2_key com chave definitiva no R2
     e. Deletar arquivo local após confirmação
```

### Supabase Edge Function: presigned URL

```typescript
// supabase/functions/r2-presign/index.ts
import { createClient } from '@supabase/supabase-js';

Deno.serve(async (req) => {
  const { filename, contentType } = await req.json();
  const userId = req.headers.get('x-user-id');
  const key = `fotos/${userId}/${Date.now()}_${filename}`;

  // Gerar presigned URL via S3 SDK para Cloudflare R2
  const url = await generatePresignedUrl(key, contentType);

  return Response.json({ url, key });
});
```

### Variáveis de ambiente necessárias

```bash
# .env.local (Next.js)
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
NEXT_PUBLIC_POWERSYNC_URL=

# Cloudflare R2
R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET_NAME=prumoq-fotos
R2_PUBLIC_URL=https://fotos.prumoq.com.br

# .env (Expo)
EXPO_PUBLIC_SUPABASE_URL=
EXPO_PUBLIC_SUPABASE_ANON_KEY=
EXPO_PUBLIC_POWERSYNC_URL=
EXPO_PUBLIC_R2_PUBLIC_URL=https://fotos.prumoq.com.br
```

---

## Indicadores de Status de Sync (UI)

### Status possíveis do PowerSync
```typescript
type SyncStatus =
  | 'initial'       // primeira inicialização
  | 'connecting'    // tentando conectar
  | 'connected'     // sincronizado
  | 'disconnected'  // sem internet
  | 'syncing'       // sincronizando ativamente
  | 'error'         // erro de sync
```

### Componente SyncStatusBar
```typescript
// Exibido no topo de todas as telas quando não está 'connected'
function SyncStatusBar({ status }: { status: SyncStatus }) {
  if (status === 'connected') return null;

  const config = {
    disconnected: { text: 'Modo offline', color: colors.warn },
    syncing:      { text: 'Sincronizando...', color: colors.progress },
    error:        { text: 'Erro de sincronização', color: colors.nok },
    connecting:   { text: 'Conectando...', color: colors.na },
  };

  // Banner fixo abaixo do header
}
```

### Badge em verificações não sincronizadas
Verificações criadas offline (`created_offline = 1`) exibem badge amarelo
"Aguardando sync" na timeline até que a operação seja confirmada.

---

## Queries PowerSync (exemplos)

### Obras do inspetor logado
```typescript
const { data: obras } = usePowerSyncQuery(
  `SELECT o.*, 
    (SELECT COUNT(*) FROM fvs_planejadas fp 
     JOIN ambientes a ON fp.ambiente_id = a.id 
     WHERE a.obra_id = o.id) as total_fvs,
    (SELECT COUNT(*) FROM fvs_planejadas fp 
     JOIN ambientes a ON fp.ambiente_id = a.id 
     WHERE a.obra_id = o.id AND fp.status = 'conforme') as fvs_concluidas,
    (SELECT COUNT(*) FROM nao_conformidades nc
     JOIN verificacoes v ON nc.verificacao_id = v.id
     JOIN fvs_planejadas fp ON v.fvs_planejada_id = fp.id
     JOIN ambientes a ON fp.ambiente_id = a.id
     WHERE a.obra_id = o.id AND nc.status = 'aberta') as nc_abertas
   FROM obras o
   JOIN obra_usuarios ou ON ou.obra_id = o.id
   WHERE ou.usuario_id = ? AND ou.ativo = 1
   ORDER BY o.nome`,
  [userId]
);
```

### NC abertas do inspetor
```typescript
const { data: nc } = usePowerSyncQuery(
  `SELECT nc.*, 
    vi.titulo as item_titulo,
    fp_plan.id as fvs_planejada_id,
    a.nome as ambiente_nome,
    o.nome as obra_nome,
    e.nome as responsavel_nome
   FROM nao_conformidades nc
   JOIN verificacao_itens vi ON nc.verificacao_item_id = vi.id
   JOIN verificacoes v ON nc.verificacao_id = v.id
   JOIN fvs_planejadas fp_plan ON v.fvs_planejada_id = fp_plan.id
   JOIN ambientes a ON fp_plan.ambiente_id = a.id
   JOIN obras o ON a.obra_id = o.id
   LEFT JOIN equipes e ON nc.responsavel_id = e.id
   WHERE nc.status = 'aberta'
   ORDER BY nc.data_nova_verif ASC`,
  []
);
```

---

## Inicialização do PowerSync

```typescript
// app/_layout.tsx (Expo Router)
export default function RootLayout() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    async function init() {
      await db.init();
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        await db.connect(new SupabaseConnector());
      }
      setReady(true);
    }
    init();
  }, []);

  // Reconectar quando sessão mudar
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === 'SIGNED_IN' && session) {
          await db.connect(new SupabaseConnector());
        }
        if (event === 'SIGNED_OUT') {
          await db.disconnect();
          await db.clearLocal(); // limpa dados locais no logout
        }
      }
    );
    return () => subscription.unsubscribe();
  }, []);

  if (!ready) return <SplashScreen />;
  return <PowerSyncContext.Provider value={db}>...</PowerSyncContext.Provider>;
}
```

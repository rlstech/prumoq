# PrumoQ — Especificação: Ciclo de Vida da FVS

## Contexto

Este documento descreve as mudanças necessárias no fluxo da FVS.
O arquivo de referência visual está em `references/prumoq_fvs_lifecycle.html`.

---

## Novos estados da FVS (tabela `fvs_planejadas`)

O campo `status` do tipo `status_fvs` precisa de novos valores:

```sql
-- Adicionar ao enum existente
ALTER TYPE status_fvs ADD VALUE 'concluida';       -- concluída pelo inspetor
ALTER TYPE status_fvs ADD VALUE 'em_revisao';      -- reaberta com justificativa
ALTER TYPE status_fvs ADD VALUE 'concluida_ressalva'; -- concluída antes de 100%
```

### Mapa completo de estados

| Estado | Descrição | Pode fazer verificação? |
|---|---|---|
| `pendente` | 0 verificações registradas | Sim |
| `em_andamento` | 1+ verificações, % < 100 | Sim |
| `em_andamento` | verificação com % = 100, aguardando confirmação | Sim (até concluir) |
| `concluida` | Inspetor confirmou conclusão, 100% | **Não — bloqueado** |
| `concluida_ressalva` | Concluída antes de 100% com justificativa | **Não — bloqueado** |
| `em_revisao` | Reaberta com autorização após conclusão | Sim |

---

## Novas tabelas necessárias

### `fvs_conclusoes`
Registra cada evento de conclusão (pode haver mais de uma por FVS reaberta).

```sql
CREATE TABLE fvs_conclusoes (
  id                  uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  fvs_planejada_id    uuid NOT NULL REFERENCES fvs_planejadas(id) ON DELETE CASCADE,
  inspetor_id         uuid NOT NULL REFERENCES usuarios(id),
  numero_conclusao    integer NOT NULL DEFAULT 1,  -- 1ª, 2ª, 3ª conclusão
  percentual_final    integer NOT NULL,             -- % no momento da conclusão
  resultado           text NOT NULL CHECK (resultado IN ('aprovado', 'com_ressalva')),
  motivo_antes_100    text,                         -- preenchido se % < 100
  tipo_motivo         text,                         -- enum de motivos pré-definidos
  observacao_final    text,
  assinatura_url      text,                         -- PNG no R2
  assinada_em         timestamptz,
  created_at          timestamptz NOT NULL DEFAULT now()
);
```

### `fvs_reaberturas`
Registra cada evento de reabertura após conclusão.

```sql
CREATE TABLE fvs_reaberturas (
  id                  uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  fvs_planejada_id    uuid NOT NULL REFERENCES fvs_planejadas(id) ON DELETE CASCADE,
  solicitado_por      uuid NOT NULL REFERENCES usuarios(id),
  autorizado_por      uuid NOT NULL REFERENCES usuarios(id),
  motivo_tipo         text NOT NULL,  -- 'reclamacao_cliente', 'auditoria', 'servico_complementar', 'correcao_registro', 'determinacao_engenharia', 'outro'
  justificativa       text NOT NULL,
  numero_reabertura   integer NOT NULL DEFAULT 1,  -- 1ª, 2ª reabertura
  created_at          timestamptz NOT NULL DEFAULT now()
);
```

---

## Alterações na tabela `fvs_planejadas`

```sql
-- Novos campos
ALTER TABLE fvs_planejadas 
  ADD COLUMN total_reaberturas    integer NOT NULL DEFAULT 0,
  ADD COLUMN total_conclusoes     integer NOT NULL DEFAULT 0,
  ADD COLUMN ultima_conclusao_em  timestamptz,
  ADD COLUMN ultima_reabertura_em timestamptz;
```

---

## Regras de negócio

### RN-FVS-01: Bloqueio de verificação em FVS concluída
- Status `concluida` ou `concluida_ressalva` → botão "+ Nova verificação" não existe
- Se o usuário tentar via URL direta → redirecionar para tela de bloqueio
- A tela de bloqueio mostra os motivos de reabertura e botão "Solicitar reabertura"

### RN-FVS-02: Conclusão ao atingir 100%
- Quando verificação salva com `percentual_exec = 100` → sistema NÃO conclui automaticamente
- Exibir banner/modal "Serviço a 100% — deseja concluir?" com dois botões:
  - "Concluir serviço agora" → abre tela de conclusão
  - "Fazer mais uma verificação" → fecha o banner, segue em `em_andamento`
- O banner só aparece UMA vez por sessão (não repetir a cada acesso)

### RN-FVS-03: Conclusão manual (antes ou depois de 100%)
- Botão "Concluir serviço" disponível no histórico da FVS quando status = `em_andamento`
- Se `percentual_exec < 100`:
  - Exibir alerta laranja obrigatório
  - Campo `motivo_antes_100` obrigatório (select + textarea)
  - Resultado final = `com_ressalva` automaticamente
- Se `percentual_exec = 100`:
  - Resultado final = `aprovado` (padrão) ou `com_ressalva` (seleção do inspetor)
- Campos obrigatórios na conclusão:
  1. Resultado final (aprovado / com ressalva)
  2. Observação final (opcional se aprovado, obrigatória se com ressalva)
  3. Assinatura digital do inspetor logado
- Ao confirmar:
  - Inserir em `fvs_conclusoes`
  - Atualizar `fvs_planejadas.status` → `concluida` ou `concluida_ressalva`
  - Atualizar `fvs_planejadas.concluida_em`
  - Incrementar `fvs_planejadas.total_conclusoes`

### RN-FVS-04: Reabertura de FVS concluída
- Quem pode autorizar: usuário com perfil `gestor` ou `admin`, OU o próprio engenheiro da obra
- Quem pode solicitar: qualquer inspetor com acesso à obra
- Se solicitante tiver perfil gestor/admin: pode autorizar a própria solicitação
- Campos obrigatórios:
  1. Tipo do motivo (select pré-definido)
  2. Justificativa detalhada (textarea, mín. 20 chars)
  3. Autorizado por (select de gestores/engenheiros da obra)
- Ao confirmar:
  - Inserir em `fvs_reaberturas`
  - Atualizar `fvs_planejadas.status` → `em_revisao`
  - Incrementar `fvs_planejadas.total_reaberturas`
  - Atualizar `fvs_planejadas.ultima_reabertura_em`

### RN-FVS-05: Verificação em status `em_revisao`
- Funciona exatamente como `em_andamento`
- Na timeline, a reabertura aparece como evento distinto (cor roxa) ANTES das novas verificações
- Após salvar nova verificação em `em_revisao`, status volta para `em_revisao` (não para `em_andamento`)
- Para voltar a concluir, o inspetor usa o botão "Concluir serviço" normalmente

### RN-FVS-06: Histórico preservado
- Nenhuma verificação, conclusão ou reabertura é deletada jamais
- A timeline mostra TUDO em ordem cronológica decrescente:
  - Eventos de reabertura (roxo)
  - Eventos de conclusão (dourado/verde)
  - Verificações normais (verde/vermelho/azul)

---

## Tipos de motivo de reabertura (enum)

```typescript
type MotivoReabertura =
  | 'reclamacao_cliente'        // "Reclamação de cliente / vistoria"
  | 'auditoria_interna'         // "Auditoria interna de qualidade"
  | 'servico_complementar'      // "Serviço complementar identificado"
  | 'correcao_registro'         // "Correção de registro incorreto"
  | 'determinacao_engenharia'   // "Determinação da engenharia"
  | 'outro'                     // "Outro — descrever"
```

## Tipos de motivo de conclusão antes de 100%

```typescript
type MotivoConclusaoAntecipada =
  | 'escopo_conforme_projeto'   // "Serviço concluído conforme projeto (% estimada)"
  | 'escopo_alterado'           // "Escopo alterado por ordem do cliente"
  | 'responsabilidade_outra'    // "Etapa final não é responsabilidade desta equipe"
  | 'decisao_tecnica'           // "Serviço encerrado por decisão técnica"
  | 'outro'                     // "Outro — descrever"
```

---

## Componentes novos necessários (mobile)

### `FVSConclusionModal`
Modal de confirmação de conclusão com:
- Alerta condicional se % < 100
- Select de resultado (aprovado / com ressalva)
- Textarea de observação final
- Canvas de assinatura digital
- Botão confirmar com loading state

### `FVSReopenModal`  
Modal de reabertura com:
- Select de tipo de motivo
- Textarea de justificativa (mín. 20 chars)
- Select de quem autorizou (lista de gestores da obra)
- Botão confirmar

### `FVSLockedScreen`
Exibida no lugar do histórico quando status é `concluida` / `concluida_ressalva`:
- Ícone de cadeado
- Resumo da conclusão (data, inspetor, resultado)
- Lista de motivos de reabertura como atalho
- Botão "Solicitar reabertura"

### `FVSTimelineEvent` (atualizar existente)
Adicionar suporte a novos tipos de evento:
- `conclusao` — dourado/verde, ícone ★
- `conclusao_ressalva` — laranja, ícone ⚑  
- `reabertura` — roxo, ícone ↑

### `FVS100PercentBanner`
Banner contextual exibido após salvar verificação com 100%:
- Aparece na tela de histórico
- Dois botões: concluir / continuar verificando
- Dismissível (não volta após fechar)

---

## Impacto no painel web admin

### Tela de Verificações (`/verificacoes`)
- Adicionar coluna "Conclusões" na tabela (mostra N conclusões + N reaberturas)
- Filtro adicional: "Status da FVS" incluindo os novos estados

### Tela de Ambiente (`/obras/[id]/ambiente/[ambId]`)
- Cards de FVS: mostrar badge roxo "Em revisão" e badge "Reaberta X vez(es)"
- FVS concluídas com ressalva: badge laranja em vez de verde

### Relatório PDF da FVS
- Incluir seção "Histórico de reaberturas" se `total_reaberturas > 0`
- Incluir todas as conclusões com assinatura de cada uma

---

## Ordem de implementação sugerida

1. Executar as migrations SQL (novos campos + tabelas)
2. Atualizar tipos TypeScript (`supabase gen types`)
3. Atualizar schema PowerSync com as novas tabelas
4. Implementar `FVSLockedScreen` (bloquear acesso)
5. Implementar `FVS100PercentBanner`
6. Implementar `FVSConclusionModal`
7. Implementar `FVSReopenModal`
8. Atualizar `FVSTimeline` para os novos tipos de evento
9. Atualizar painel web admin
10. Atualizar geração de PDF

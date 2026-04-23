# PrumoQ — Especificação: Fluxo de Re-inspeção de NC

## Contexto

Este documento descreve o fluxo completo de re-inspeção de uma Não Conformidade (NC).
O arquivo de referência visual está em `references/prumoq_nc_reinspecao.html`.

---

## O que já existe (não alterar)

- Tabela `nao_conformidades` com campos básicos
- Tabela `nc_fotos` para fotos de evidência
- Status `aberta` e `resolvida` no campo `status` da NC
- Tela de Nova Verificação com painel de NC quando item = `nao_conforme`
- Tela de histórico da FVS com timeline

---

## O que precisa ser adicionado / alterado

### 1. Novos campos na tabela `nao_conformidades`

```sql
ALTER TABLE nao_conformidades
  ADD COLUMN numero_ocorrencia   integer NOT NULL DEFAULT 1,
  ADD COLUMN nc_anterior_id      uuid REFERENCES nao_conformidades(id),
  ADD COLUMN verificacao_reinsp_id uuid REFERENCES verificacoes(id),
  ADD COLUMN foto_reinspecao_url text,
  ADD COLUMN obs_resolucao       text,
  ADD COLUMN prioridade          text NOT NULL DEFAULT 'media'
    CHECK (prioridade IN ('alta', 'media', 'baixa'));
```

### 2. Novo status de NC

```sql
ALTER TYPE status_nc ADD VALUE 'encerrada_sem_resolucao';
-- Status completo: 'aberta' | 'em_correcao' | 'resolvida' | 
--                 'encerrada_sem_resolucao' | 'cancelada'
```

### 3. Nova tabela `nc_reinspecoes`

Registra cada tentativa de re-inspeção (aprovada ou reprovada).

```sql
CREATE TABLE nc_reinspecoes (
  id                  uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  nc_id               uuid NOT NULL REFERENCES nao_conformidades(id),
  verificacao_id      uuid NOT NULL REFERENCES verificacoes(id),
  inspetor_id         uuid NOT NULL REFERENCES usuarios(id),
  resultado           text NOT NULL CHECK (resultado IN ('aprovada', 'reprovada')),
  observacao          text,
  foto_url            text,       -- foto obrigatória da re-inspeção
  nova_nc_id          uuid REFERENCES nao_conformidades(id), -- se reprovada
  created_at          timestamptz NOT NULL DEFAULT now()
);
```

---

## Regras de negócio

### RN-NC-01: Gatilho de NC
Quando inspetor marca item como `nao_conforme` em qualquer verificação:
- Painel de NC expande obrigatoriamente no mesmo item
- Campos obrigatórios antes de salvar a verificação:
  1. Descrição da NC (textarea, mín. 10 chars)
  2. Pelo menos 1 foto de evidência
  3. Solução proposta (textarea, mín. 10 chars)
  4. Nova data de re-inspeção (date, deve ser >= data de hoje)
  5. Responsável pela correção (select de equipes da obra)
- Prioridade calculada automaticamente:
  - Se `numero_ocorrencia >= 2` → prioridade sobe automaticamente para `alta`
  - Primeira ocorrência → `media` (padrão, editável)

### RN-NC-02: Acesso à re-inspeção
O inspetor chega à re-inspeção por dois caminhos:
1. **Aba NC** → card da NC → botão "Re-inspecionar"
2. **Histórico da FVS** → botão "+ Nova verificação" (quando há NC aberta no serviço, 
   o sistema exibe banner informativo antes de abrir o formulário)

### RN-NC-03: Formulário de re-inspeção
A tela de Nova Verificação quando há NC aberta deve:
- Exibir banner azul no topo: "Re-inspeção de NC aberta"
- Mostrar o item que gerou a NC em destaque (borda vermelha, badge "NC aberta")
- O item em NC fica no TOPO do checklist, antes dos outros itens
- Os demais itens aparecem normalmente abaixo
- Foto de re-inspeção é OBRIGATÓRIA (campo separado das fotos gerais)
- Inspetor preenche o checklist completo normalmente

### RN-NC-04: Resultado da re-inspeção — Aprovada
Se inspetor marca o item que estava em NC como `conforme`:
1. Criar registro em `nc_reinspecoes` com `resultado = 'aprovada'`
2. Atualizar `nao_conformidades.status` → `resolvida`
3. Atualizar `nao_conformidades.resolvida_em` → now()
4. Atualizar `nao_conformidades.verificacao_reinsp_id` → id da verificação atual
5. Atualizar `nao_conformidades.foto_reinspecao_url` → URL da foto obrigatória
6. Exibir tela de conclusão da re-inspeção (ver componente `NCResolvedScreen`)

### RN-NC-05: Resultado da re-inspeção — Reprovada
Se inspetor marca o item como `nao_conforme` novamente:
1. Criar registro em `nc_reinspecoes` com `resultado = 'reprovada'`
2. Atualizar NC anterior: `status` → `encerrada_sem_resolucao`
3. Abrir formulário de NOVA NC automaticamente (não fechar a tela):
   - `numero_ocorrencia` = NC anterior + 1
   - `nc_anterior_id` = id da NC anterior
   - Se `numero_ocorrencia >= 2` → prioridade automática = `alta`
   - Todos os campos obrigatórios novamente (descrição, foto, solução, prazo, responsável)
4. Não permitir salvar a verificação sem a nova NC preenchida

### RN-NC-06: NC aberta bloqueia conclusão da FVS
- Uma FVS com NC de status `aberta` não pode ser concluída
- Ao tentar concluir: exibir aviso "Existem X NC(s) abertas. Resolva-as antes de concluir."
- Exceção: FVS pode ser concluída com `com_ressalva` se NC estiver em status `em_correcao`
  e o inspetor justificar explicitamente

### RN-NC-07: Foto obrigatória na re-inspeção
- Campo separado das fotos gerais da verificação
- Label: "Foto da re-inspeção (obrigatória)"
- Mínimo: 1 foto
- Upload segue o mesmo fluxo offline-first das outras fotos

---

## Fluxo de dados completo

```
Item marcado como nao_conforme
  ↓
Painel NC expande (obrigatório)
  ↓ [preencher: descrição + foto + solução + prazo + responsável]
Verificação salva
  ↓
nao_conformidades INSERT (status = 'aberta', numero_ocorrencia = 1)
  ↓
[inspetor corrige o problema]
  ↓
Nova verificação criada (re-inspeção)
  ↓
  ├── Item marcado como CONFORME
  │     ↓
  │   nc_reinspecoes INSERT (resultado = 'aprovada')
  │   nao_conformidades UPDATE (status = 'resolvida')
  │   verificacao salva normalmente
  │     ↓
  │   NCResolvedScreen exibida
  │
  └── Item marcado como NÃO CONFORME novamente
        ↓
      nc_reinspecoes INSERT (resultado = 'reprovada')
      nao_conformidades UPDATE anterior (status = 'encerrada_sem_resolucao')
      Nova NC criada (numero_ocorrencia = 2, nc_anterior_id = anterior)
        ↓
      Verificação salva com nova NC
```

---

## Componentes novos (mobile)

### `NCReinspectionBanner`
Banner azul exibido no topo da tela de Nova Verificação quando há NC aberta:
```
┌─────────────────────────────────────┐
│ 🔄  Re-inspeção de NC aberta        │
│     Item 2 — Espessura da argamassa │
└─────────────────────────────────────┘
```
Props: `ncItem: string, ncDescricao: string`

### `ChecklistItemNC` (atualizar existente)
O item do checklist que tem NC aberta deve:
- Aparecer primeiro na lista (ordenação: NC abertas primeiro, depois os demais)
- Ter borda lateral vermelha (3px)
- Badge "NC aberta" no header
- Header com fundo `--nokb`
- Ao ser marcado como conforme: abrir `NCReinspectionPhotoPrompt`

### `NCReinspectionPhotoPrompt`
Prompt que aparece quando item NC é marcado como conforme durante re-inspeção:
```
"Você está aprovando um item que estava em NC.
 Adicione uma foto da re-inspeção para documentar a correção."
[📷 Adicionar foto obrigatória]
```
Não permite prosseguir sem a foto.

### `NCReprovadaPanel`
Painel que aparece quando item é reprovado novamente (RN-NC-05):
```
┌─ ✗ Item não conforme novamente ───────┐
│  2ª ocorrência · Nova NC gerada       │
│                                       │
│  [Descrição da nova NC *]             │
│  [📷 Foto obrigatória *]              │
│  [Solução proposta *]                 │
│  [Nova data de re-inspeção *]         │
│  [Responsável pela correção]          │
│  Prioridade: ● Alta (automática)      │
└───────────────────────────────────────┘
```
Props: `numerOcorrencia: number, ncAnteriorId: string`

### `NCResolvedScreen`
Tela exibida após re-inspeção aprovada (substitui a tela normal de "verificação salva"):
```
┌─────────────────────────────────────┐
│         ✅ NC Resolvida!            │
│   Item aprovado na re-inspeção      │
│                                     │
│  Item:          Espessura argamassa  │
│  Aberta em:     01/04/2025          │
│  Resolvida em:  08/04/2025          │
│  Tempo total:   7 dias              │
│                                     │
│  [foto da re-inspeção thumbnail]    │
│                                     │
│  [🖨 Exportar PDF]  [Concluir ✓]   │
└─────────────────────────────────────┘
```

### `NCHistoryCard` (atualizar existente)
Na timeline da FVS, o card de NC deve mostrar:
- Status atual da NC (badge colorido)
- Se resolvida: link para a verificação de re-inspeção
- Se encerrada sem resolução: exibir a NC successor (badge "Ver NC 002 →")
- Contador de ocorrências: "2ª ocorrência" se numero_ocorrencia > 1

---

## Componentes novos (web admin)

### Tela de NC (`/nc`)
Adicionar coluna "Ocorrência" na tabela (badge "2ª", "3ª" em vermelho quando > 1).
Adicionar filtro por número de ocorrência.

### Modal de detalhe da NC
Adicionar seção "Histórico de re-inspeções":
```
Re-inspeção 1 — 08/04/2025 — Reprovada
  Foto: [thumbnail]
  → Gerou NC 002

Re-inspeção 2 — 12/04/2025 — Aprovada  
  Foto: [thumbnail]
  NC encerrada como resolvida
```

### Indicador na lista de ambientes
Se ambiente tem NC com `numero_ocorrencia >= 2`: badge vermelho "Reincidente".

---

## Queries PowerSync necessárias (adicionar ao sync-rules)

```yaml
# NC com re-inspeções
nc_reinspecoes_das_obras:
  data:
    - table: nc_reinspecoes
      where: >
        nc_id IN (
          SELECT nc.id FROM nao_conformidades nc
          JOIN verificacoes v ON nc.verificacao_id = v.id
          JOIN fvs_planejadas fp ON v.fvs_planejada_id = fp.id
          JOIN ambientes a ON fp.ambiente_id = a.id
          JOIN obra_usuarios ou ON a.obra_id = ou.obra_id
          WHERE ou.usuario_id = :usuario_id AND ou.ativo = true
        )
```

---

## Ordem de implementação

1. Migration SQL (novos campos + nova tabela)
2. Regenerar tipos TypeScript
3. Atualizar schema PowerSync
4. Atualizar lógica de salvar verificação para criar NC corretamente
5. Implementar `NCReinspectionBanner`
6. Atualizar `ChecklistItemNC` (ordenação + destaque)
7. Implementar `NCReinspectionPhotoPrompt`
8. Implementar `NCReprovadaPanel` (re-reprovação)
9. Implementar `NCResolvedScreen`
10. Atualizar `NCHistoryCard` na timeline
11. Atualizar painel web admin (coluna ocorrência + histórico de re-inspeções)
12. Atualizar geração de PDF para incluir histórico de re-inspeções

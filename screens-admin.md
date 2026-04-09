# PrumoQ — Especificação de Telas Web Admin

## Stack Web
- **Next.js 14 + TypeScript** (App Router)
- **Supabase JS Client** (auth + queries)
- **Tailwind CSS** (styling)
- **Lucide React** (ícones)
- **React Hook Form + Zod** (formulários e validação)
- **TanStack Query** (cache e revalidação)
- **React PDF** (geração de PDF client-side)
- **Recharts** (gráficos no dashboard)

## Estrutura de Rotas (Next.js App Router)

```
app/
  (auth)/
    login/page.tsx
  (admin)/
    layout.tsx          ← Sidebar + Header
    page.tsx            ← Dashboard
    empresas/
      page.tsx          ← Lista
      [id]/page.tsx     ← Detalhe/edição
    obras/
      page.tsx          ← Lista
      [id]/
        page.tsx        ← Detalhe (abas: Ambientes | Equipe | Docs)
        ambiente/[ambId]/page.tsx  ← Detalhe ambiente + FVS planner
    fvs-padrao/
      page.tsx          ← Biblioteca
      [id]/page.tsx     ← Editor de checklist + revisões
    equipes/page.tsx
    usuarios/page.tsx
    verificacoes/page.tsx
    nc/page.tsx
    relatorios/page.tsx
```

---

## Layout Base

### Sidebar (228px, fundo #1A1A18)
Seções e itens conforme design-system.md.
Item ativo: background `--color-brand`.
Badge de alerta em NC quando há NCs abertas.
Rodapé: avatar + nome + cargo do usuário logado + botão sair.

### Header (56px, fundo branco)
- Breadcrumb dinâmico à esquerda (ex: "Obras > Res. Portal Oeste > Apt 302")
- Ações à direita: botão contextual de ação principal + botão Exportar (onde aplicável)

---

## Página 1: Login

**Rota:** `/login`

### Layout
- Fundo: `--color-brand` fullscreen
- Card branco 400px, border-radius 16px

### Campos
- E-mail (type email)
- Senha (type password)
- Botão "Entrar como Administrador"
- Hint: "Acesso restrito a usuários cadastrados"

### Lógica
- `supabase.auth.signInWithPassword()`
- Verificar `perfil` em `usuarios`:
  - `admin` ou `gestor` → redirecionar para `/` (dashboard)
  - `inspetor` → exibir erro "Use o app mobile"
- Preservar `callbackUrl` para redirect pós-login

---

## Página 2: Dashboard

**Rota:** `/`

### KPIs (grid 4 colunas)
Calculados em tempo real via Supabase:
| KPI | Query |
|---|---|
| Obras ativas | `COUNT(*) FROM obras WHERE status != 'concluida'` |
| Ambientes | `COUNT(*) FROM ambientes WHERE obra_id IN (obras da empresa)` |
| FVS concluídas | `COUNT(*) FROM fvs_planejadas WHERE status = 'conforme'` |
| NC abertas | `COUNT(*) FROM nao_conformidades WHERE status = 'aberta'` |

### Tabela de Progresso de Obras
Colunas: Obra | Empresa | Ambientes | Progresso FVS | NC | Status
- Barra de progresso inline (90px)
- Clique na linha → navega para detalhe da obra
- Paginação: 10 por página

### Atividade Recente
- Últimos 5 eventos: verificação criada, NC registrada, NC resolvida, ambiente cadastrado, usuário adicionado
- Icone colorido + descrição + tempo relativo ("2h atrás", "Ontem")

### NC Urgentes
- Tabela: Descrição | Obra/Ambiente | Prioridade | Responsável | Prazo | Status | Ação
- Filtrado: status = 'aberta' AND data_nova_verif <= hoje + 3 dias
- Botão "Ver todas" → navega para /nc

---

## Página 3: Empresas

**Rota:** `/empresas`

### Lista
Tabela: Razão Social | CNPJ | Município | Obras ativas | Inspetores | Ações (Editar)

### Modal: Nova / Editar Empresa
Campos:
- Razão social * (text)
- CNPJ * (text, máscara 00.000.000/0000-00)
- Inscrição estadual (text)
- Endereço (text)
- Município (text)
- UF (select, estados brasileiros)
- CEP (text, máscara 00000-000)
- Nome do contato principal (text)
- E-mail (email)
- Telefone (text)

Validações Zod:
```typescript
z.object({
  nome: z.string().min(3).max(200),
  cnpj: z.string().regex(/^\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}$/),
  email: z.string().email().optional(),
  uf: z.string().length(2).optional(),
})
```

---

## Página 4: Obras

**Rota:** `/obras`

### Lista
Tabela: Obra | Empresa | Engenheiro resp. | Ambientes | FVS | Progresso | Status | Ações
- Filtro por empresa (select)
- Campo de busca por nome
- Paginação 10/página

### Modal: Nova / Editar Obra
**Seção 1: Identificação**
- Nome da obra * (text)
- Empresa * (select — lista de empresas)
- Tipo de obra (select: residencial, comercial, industrial, infraestrutura, outro)
- Endereço + município + UF + CEP

**Seção 2: Responsável Técnico**
- Engenheiro responsável * (text)
- CREA/CAU * (text)
- Número da ART (text)
- Número do alvará (text)

**Seção 3: Dados Técnicos**
- Área total (m²) (number)
- Número de pavimentos (number)

**Seção 4: Cronograma**
- Início previsto (date)
- Início real (date)
- Término previsto (date)
- Status (select: não iniciada, em andamento, paralisada, concluída)

---

## Página 5: Detalhe da Obra

**Rota:** `/obras/[id]`

### Cabeçalho
- Nome da obra + status badge
- Empresa + endereço + engenheiro (CREA)

### KPIs (4 cards)
Ambientes | FVS Planejadas | Concluídas | NC Abertas

### Abas

**Aba: Ambientes**
- Filtros: Todos | Internos | Externos | Com NC
- Campo de busca por nome
- Grid responsivo de cards de ambientes
  - Linha colorida no topo: azul (interno) | verde (externo)
  - Nome + tipo + localização
  - Badge X/Y FVS
  - Barra de progresso
  - Clique → navega para `/obras/[id]/ambiente/[ambId]`
- Card "+ Novo ambiente" (abre modal)

**Aba: Equipe**
- Lista de membros: engenheiro, inspetores, equipes executoras
- Botão "+ Adicionar" abre modal de seleção

**Aba: Documentos**
- Upload de ART, projetos, memoriais (futuro v1.1)

### Modal: Novo Ambiente
Campos:
- Nome do ambiente * (text, ex: "Apartamento 302")
- Tipo * (radio: Interno | Externo)
- Localização * (text, ex: "Piso 3")
- Observações (textarea)

**Seleção de FVS Padrão:**
- Lista de todas as FVS Padrão ativas da empresa
- Checkboxes para seleção múltipla
- Para cada FVS selecionada: campo opcional "Subserviço" (ex: "Piso", "Paredes")
- Hint: "As FVS selecionadas serão criadas como planejadas neste ambiente"

---

## Página 6: Detalhe do Ambiente (FVS Planner)

**Rota:** `/obras/[id]/ambiente/[ambId]`

### Layout dois painéis
- **Esquerda (flex:1):** Lista de FVS planejadas
- **Direita (340px):** Resumo + Informações

### Painel Esquerdo: FVS Planejadas
Header: "FVS planejadas · X serviços · Y concluídos"
Lista (uma linha por FVS):
- Ponto colorido de status
- Nome do serviço + subserviço
- Número de verificações + data última
- Badge de status
- Botão "Checklist" → abre modal editor

### Modal: Editor de Checklist
- Título: "Checklist — [nome da FVS]"
- Nota: "Esta instância usa [FVS Padrão: nome] Rev. X"
- Lista de itens com campos:
  - Ordem (drag handle futuro)
  - Título do item
  - Método de verificação (textarea)
  - Tolerância (input)
  - Botão remover
- Botão "+ Adicionar item"
- Footer: Cancelar | Salvar (salva como override local do ambiente)

### Painel Direito: Informações
- Progresso (número grande + barra)
- Mini-grid: concluídas | NC | pendentes
- Dados: tipo, localização, inspetor, data de criação

---

## Página 7: FVS Padrão (Biblioteca)

**Rota:** `/fvs-padrao`

### KPIs (4 cards)
Total cadastradas | Ativas | Inativas | Revisões registradas

### Tabela Principal
Colunas: Nome da FVS | Categoria | Itens | Revisão | Última alteração | Obras usando | Status (toggle) | Ações

- **Toggle de status** (ativo/inativo):
  - Switch inline na tabela
  - Confirmação antes de inativar se `obras_usando > 0`
  - Alerta: "X ambientes usam esta FVS. Eles continuarão funcionando normalmente."

- **Clique na linha** → navega para `/fvs-padrao/[id]`

### Filtros
- Select: Todas as categorias | Estrutura | Vedação | Revestimento | Instalações | Cobertura | Acabamento
- Campo de busca por nome

---

## Página 8: Detalhe da FVS Padrão (Editor)

**Rota:** `/fvs-padrao/[id]`

### Header da Página
- Nome + categoria + revisão atual + data da última alteração + quem alterou
- Toggle ativo/inativo (com label "Ativa" / "Inativa")
- Botões: "Histórico de revisões" | "Salvar nova revisão"

### Layout dois painéis

**Painel Esquerdo: Editor de Itens**
Card com lista de itens editáveis:
- Header do card: "Itens de verificação" + hint "X itens"
- Por item:
  - Número da ordem (futuro: drag para reordenar)
  - Título (input)
  - Método de verificação (textarea, min-height 56px)
  - Tolerância (input, placeholder "Sem tolerância numérica")
  - Botão "Remover"
- Botão "+ Adicionar item de verificação"

**Painel Direito: Sidebar de Informações**

Card "Informações da FVS":
- Nome * (input)
- Categoria * (select)
- Descrição / Aplicação (textarea)
- Norma de referência (input, ex: "ABNT NBR 7200:2019")

Card "Uso atual":
- Obras usando: N
- Ambientes vinculados: N
- Verificações realizadas: N

Card "Histórico de revisões":
- Lista compacta das revisões (rev. atual destaque, antigas opacas)
- Cada revisão: número + data + resumo das alterações + quem fez

### Modal: Salvar Nova Revisão
- Alerta: "Será criada Rev. X. A versão anterior ficará no histórico."
- Campo: "Descreva as alterações desta revisão" (textarea, obrigatório)
- Campo: "Revisado por" (read-only, usuário logado)
- Aviso em laranja: "Esta revisão afetará Y ambientes que usam esta FVS em obras ativas."
- Botões: Cancelar | "Publicar Rev. X"

---

## Página 9: Equipes

**Rota:** `/equipes`

### Layout dois painéis lado a lado
- **Esquerdo:** Funcionários próprios (com badge de quantidade)
- **Direito:** Terceirizados (com badge de quantidade)

### Itens de cada lista
- Avatar com iniciais (verde = próprio, laranja = terceirizado)
- Nome + descrição (cargo/especialidade)
- Tag de tipo
- Botão Editar

### Modal: Nova / Editar Equipe
Campos:
- Tipo * (radio: Funcionário próprio | Empresa terceirizada)
- Nome da equipe / empresa * (text)
- Responsável / Mestre (text)
- Telefone (text)
- CNPJ (text, só para terceirizados)
- Especialidade (text)

---

## Página 10: Usuários

**Rota:** `/usuarios`

### Tabela
Colunas: Nome (com avatar) | E-mail | Perfil (badge) | Obras com acesso (pills) | Último acesso | Ações

### Modal: Novo / Editar Usuário
**Seção 1: Dados**
- Nome completo * (text)
- Cargo (text)
- E-mail corporativo * (email) — usado como login
- Celular (text)
- Perfil de acesso * (select: Admin | Gestor | Inspetor)
- Status (select: Ativo | Inativo)

**Seção 2: Senha (só criação)**
- Senha * (password, mín 8 chars)
- Confirmar senha *

**Seção 3: Obras com acesso**
- Lista de todas as obras da empresa com checkboxes
- Label: "O usuário verá apenas as obras marcadas abaixo."
- (Admins têm acesso a todas automaticamente — checkboxes disabled)

### Ação: Criar usuário
1. `supabase.auth.admin.createUser({ email, password, email_confirm: true })`
2. Inserir em `usuarios` com o UUID retornado
3. Inserir em `obra_usuarios` para cada obra selecionada

---

## Página 11: Verificações

**Rota:** `/verificacoes`

### Painel de Filtros (card no topo)
Grid 5 colunas + botão Filtrar:
- Obra (select)
- Ambiente (select, dependente da obra)
- Serviço/FVS (select)
- Status (select: Todos | Conforme | Não conforme | Em andamento)
- Inspetor (select)

### Tabela de Resultados
Colunas: Nº Verif. | Serviço / FVS | Obra / Ambiente | % Exec. | Resultado | Inspetor | Data | Fotos | Ação (Ver)

- **% Exec.:** barra de progresso inline
- **Fotos:** badge "📷 N fotos" clicável → abre modal de detalhe direto na aba de fotos
- **Clique na linha** → abre modal de detalhe da verificação

### Modal: Detalhe da Verificação
Layout dois painéis:

**Painel Esquerdo:**
- Mini-KPIs: % execução | Conformes | Não conformes | N/A
- "Resultado dos itens": lista compacta com ícone (✓/✗/—) + título + método
  - Se NC: sub-card vermelho com descrição + solução + prazo + status
- "Observações gerais"
- "Assinatura digital": visualização do PNG + "Nome — data hora"

**Painel Direito:**
- "Fotos de evidência (N)": grid 3 colunas, clique → lightbox fullscreen
  - Lightbox: imagem grande + navegação anterior/próxima + legenda + botão fechar
- "Não conformidade registrada" (se houver): card vermelho com todos os campos
- "Equipe executora": card com tipo e nome
- "Engenheiro responsável": card com CREA

Footer do modal: [🖨 Exportar PDF] [Fechar]

---

## Página 12: Não Conformidades

**Rota:** `/nc`

### KPIs (4 cards)
NC Abertas | Prazo próximo (≤ 3 dias) | Resolvidas este mês | Tempo médio resolução (dias)

### Filtros
- Select: Todas as obras
- Select: Status (Todas | Abertas | Resolvidas | Canceladas)

### Tabela
Colunas: Descrição | Serviço / Ambiente | Obra | Prioridade | Responsável | Prazo | Status | Ações

- **Prioridade:** ponto colorido + texto (Alta/Média/Baixa)
- **Prazo:** badge colorido:
  - Vencido: badge vermelho "Vencida"
  - Hoje: badge vermelho "Hoje"
  - ≤ 3 dias: badge laranja com data
  - Resolvida: data simples
- **Status:** badge (Aberta/Em correção/Resolvida)
- **Ação:** botão "Ver" → modal de detalhe da verificação

---

## Página 13: Relatórios

**Rota:** `/relatorios`

### Cards de Relatório (grid 3 colunas)
Cada card: ícone grande + título + descrição + botão de ação

| Relatório | Formato | Conteúdo |
|---|---|---|
| Relatório de FVS | PDF | Todas as verificações por obra e período |
| Não Conformidades | Excel | NC com status, soluções e tempo resolução |
| Progresso de Obras | Excel | % conclusão por obra/ambiente/serviço |
| Ficha FVS Individual | PDF | Uma FVS com assinatura e fotos embutidas |
| Produtividade de Equipes | Excel | Verificações por inspetor/equipe |
| Painel Analítico | — | Indicadores de qualidade (futuro) |

### Modal: Selecionar Parâmetros (antes de gerar)
- Obra (select, opcional — "Todas")
- Período (date range picker)
- Status a incluir (checkboxes)
- Botão "Gerar"

### Geração de PDF (Ficha FVS Individual)
Usando React PDF, incluir:
- Cabeçalho: logo PrumoQ + dados da obra + data de emissão
- Dados do serviço: obra, ambiente, inspetor, engenheiro, equipe
- Tabela de itens com resultado (✓/✗/—), método e tolerância
- NC (se houver) com foto em miniatura e solução
- Fotos de evidência em grid (máx 6 por página)
- Assinatura digital
- Rodapé: número da verificação + data + revisão da FVS

---

## Componentes Compartilhados (Web)

### `DataTable`
Props: `columns, data, pagination, onRowClick, loading`
Suporte a ordenação por coluna e paginação server-side.

### `StatusBadge`
Props: `status: FvsStatus | NcStatus | ObraStatus, size?: 'sm' | 'md'`

### `ProgressBar`
Props: `value, variant, showLabel, size`

### `Modal`
Props: `isOpen, onClose, title, size, footer`
Trap focus, scroll interno, fecha no ESC e no backdrop.

### `PhotoGallery`
Props: `photos: {r2_key, r2_thumb_key, caption}[]`
Grid com lightbox integrado, presigned URLs automáticas.

### `ChecklistEditor`
Props: `items, onChange, readOnly`
Editor de itens de FVS com add/remove e campos inline.

### `FVSStatusToggle`
Toggle com confirmação para obras ativas.

### `ToggleSwitch`
Toggle acessível (role="switch", aria-checked).

### `Toast`
Stack de notificações bottom-right, auto-dismiss 3s.

---

## Padrões de UX

### Confirmações Destrutivas
Sempre usar modal de confirmação antes de:
- Deletar empresa/obra/ambiente
- Inativar FVS com ambientes vinculados
- Remover acesso de usuário a obras com NC abertas

### Estados de Loading
- Tabelas: skeleton rows
- Modais: spinner no botão submit
- Dados do dashboard: skeleton cards

### Estados Vazios
Cada seção deve ter um estado vazio explicativo com:
- Ícone ilustrativo
- Mensagem: "Nenhuma [entidade] cadastrada ainda"
- Botão CTA: "+ Cadastrar [entidade]"

### Formulários
- Validação em tempo real (onBlur) com mensagens inline
- Campos obrigatórios: asterisco (*) + Zod
- Máscaras: CNPJ, CPF, telefone, CEP
- Auto-save rascunho em modais longos (localStorage)

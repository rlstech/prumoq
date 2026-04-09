# PrumoQ — Especificação de Telas Mobile

## Stack Mobile
- **React Native + Expo SDK 51+**
- **Expo Router** (file-based navigation)
- **PowerSync** (SQLite offline + sync)
- **Supabase** (auth + API)
- **Cloudflare R2** (upload de fotos via presigned URL)
- **react-native-signature-canvas** (assinatura digital)
- **expo-camera / expo-image-picker** (câmera e galeria)

## Estrutura de Navegação

```
(auth)
  ├── login.tsx

(app)
  ├── (tabs)
  │   ├── index.tsx          → Dashboard
  │   ├── obras/
  │   │   ├── index.tsx      → Lista de obras
  │   │   └── [id]/
  │   │       ├── index.tsx  → Detalhe da obra (ambientes)
  │   │       └── ambiente/
  │   │           └── [ambId]/
  │   │               ├── index.tsx     → FVS do ambiente
  │   │               └── fvs/
  │   │                   └── [fvsId]/
  │   │                       ├── index.tsx     → Histórico FVS
  │   │                       └── verificacao/
  │   │                           └── nova.tsx  → Nova verificação
  │   ├── nc/
  │   │   └── index.tsx      → NC abertas
  │   └── perfil/
  │       └── index.tsx      → Perfil do inspetor
```

---

## Tela 1: Login

**Arquivo:** `app/(auth)/login.tsx`

### Layout
- Fundo: `--color-brand` (#E84A1A) fullscreen
- Card branco centralizado, border-radius 16px, padding 40px
- Logo "PrumoQ" em branco no topo, subtítulo "Qualidade em Obras"

### Campos
| Campo | Tipo | Validação |
|---|---|---|
| E-mail | TextInput, keyboardType="email-address" | Obrigatório, formato email |
| Senha | TextInput, secureTextEntry | Obrigatório, mín. 6 chars |

### Ações
- **Botão "Entrar":** chama `supabase.auth.signInWithPassword()`
- Loading state no botão durante autenticação
- Erro exibido em toast vermelho abaixo do formulário

### Pós-login
- Verificar perfil do usuário
- Se `perfil = 'admin'` ou `'gestor'` → redirecionar para web admin (não tem acesso mobile)
- Se `perfil = 'inspetor'` → navegar para `(tabs)/index`
- Inicializar PowerSync sync após login

---

## Tela 2: Dashboard

**Arquivo:** `app/(app)/(tabs)/index.tsx`

### Header
- Background: `--color-brand`
- Título: "Olá, [nome do inspetor]"
- Subtítulo: cargo + empresa
- Avatar com iniciais no canto direito (navega para Perfil)

### Conteúdo (ScrollView)

**Bloco de KPIs — grid 2x2:**
| Card | Valor | Cor |
|---|---|---|
| Obras ativas | count(obras com acesso) | brand |
| NC abertas | count(NC status=aberta) | nok |
| Verif. esta semana | count(verificacoes 7 dias) | neutro |
| Vencendo hoje | count(NC data_nova_verif = hoje) | brand-light |

**NC Urgentes (se houver):**
- Título seção: "Não conformidades urgentes"
- Cards vermelhos clicáveis com: serviço, ambiente, prazo
- Máximo 3 cartões, botão "Ver todas →" navega para aba NC

**Obras ativas:**
- Título seção: "Minhas obras"
- Cards com: nome da obra, empresa, barra de progresso, % FVS concluídas
- Clique navega para detalhe da obra

**Atividade recente:**
- Últimas 3 verificações criadas pelo inspetor logado
- Mostra: serviço + ambiente + data + badge de status

### Estado offline
- Banner amarelo fixo no topo quando sem conexão: "Modo offline — alterações serão sincronizadas ao conectar"
- Indicador de sync: ícone circular animado quando sincronizando

---

## Tela 3: Lista de Obras

**Arquivo:** `app/(app)/(tabs)/obras/index.tsx`

### Header
- Título: "Minhas Obras"
- Subtítulo: "[n] obras ativas"

### Conteúdo
- Campo de busca no topo (filtra por nome ou empresa)
- Lista de cards, um por obra:
  - Nome + status badge
  - Empresa + cidade
  - Barra de progresso + porcentagem
  - Total de FVS e NC abertas

### Dados
Query PowerSync:
```sql
SELECT o.*, 
  (SELECT COUNT(*) FROM fvs_planejadas fp 
   JOIN ambientes a ON fp.ambiente_id = a.id 
   WHERE a.obra_id = o.id) as total_fvs,
  (SELECT COUNT(*) FROM fvs_planejadas fp 
   JOIN ambientes a ON fp.ambiente_id = a.id 
   WHERE a.obra_id = o.id AND fp.status = 'conforme') as fvs_concluidas
FROM obras o
JOIN obra_usuarios ou ON ou.obra_id = o.id
WHERE ou.usuario_id = [current_user_id] AND ou.ativo = true
```

---

## Tela 4: Detalhe da Obra (Ambientes)

**Arquivo:** `app/(app)/(tabs)/obras/[id]/index.tsx`

### Header
- Botão voltar + nome da obra + empresa

### Painel de Progresso
- Card laranja claro com: nome da obra, endereço
- 3 barras de progresso: FVS totais, Conformes, NC abertas
- Grid 4 KPIs: Ambientes, FVS planejadas, Concluídas, NC abertas

### Filtros
- Chips horizontais: Todos | Internos | Externos | Com NC
- Filtragem local (sem nova query)

### Grid de Ambientes (2 colunas)
Cada card:
- Linha colorida no topo: azul (interno) | verde (externo)
- Nome do ambiente
- Tipo + localização
- Badge de progresso (X/Y FVS)
- Barra de progresso
- Se tem NC aberta: badge vermelho "NC"

---

## Tela 5: FVS do Ambiente

**Arquivo:** `app/(app)/(tabs)/obras/[id]/ambiente/[ambId]/index.tsx`

### Header
- Voltar + nome do ambiente + tipo + obra

### Painel Resumo
- "FVS planejadas" + "Concluídas X/Y"
- Barra de progresso geral do ambiente

### Lista de Serviços
Cada item (FlatList):
- Ícone circular de status (✓ ok | ! nok | → pg | ○ pendente)
- Nome do serviço + subserviço
- Data da última verificação (ou "Não iniciado")
- Badge de status + número de verificações
- Clique → Histórico FVS

---

## Tela 6: Histórico FVS

**Arquivo:** `app/(app)/(tabs)/obras/[id]/ambiente/[ambId]/fvs/[fvsId]/index.tsx`

### Header
- Voltar + nome do serviço + localização

### Painel de Status
- Status atual (badge colorido)
- Número de verificações realizadas
- Mini resumo: Conformes | Não Conformes | Pendentes

### Botão "Nova Verificação"
- Exibido à direita do título "Histórico"
- Badge azul com "+ Nova verificação"

### Timeline
Entrada por verificação (mais recente primeiro):
- Ponto colorido na linha lateral (ok/nok/pg)
- Card com fundo `--surface2`:
  - Data + hora + nome do inspetor
  - Título "Verificação N — X% execução" + badge status
  - Texto de observações gerais
  - **Se há NC:** card vermelho interno com:
    - Título do item + descrição
    - Solução proposta
    - Se resolvida: badge verde "Resolvida na Verificação N"
    - Se aberta: prazo + responsável
  - Miniaturas de fotos (máx 4 exibidas)
  - Badge "✓ Assinado digitalmente" ou "Sem assinatura"

---

## Tela 7: Nova Verificação

**Arquivo:** `app/(app)/(tabs)/obras/[id]/ambiente/[ambId]/fvs/[fvsId]/verificacao/nova.tsx`

Esta é a tela mais complexa do app. Usar ScrollView com seções bem delimitadas.

### Seção 1: Inspetor (read-only)
Card laranja com avatar + nome + cargo + cadeado "Logado"
Não editável. Preenchido automaticamente.

### Seção 2: Data
- DatePicker nativo, default = hoje

### Seção 3: Equipe executora
- Dropdown com engenheiro responsável (fixo da obra, read-only)
- Select de equipe executora (lista de equipes da obra)
- Card verde/laranja confirmando a equipe selecionada com tipo (Próprio/Terceirizado)

### Seção 4: Percentual de execução
- Slider de 0 a 100, step 5
- Valor exibido à direita: "85%"
- Barra de progresso visual abaixo

### Seção 5: Itens de Verificação
Para cada item do checklist (da FVS Padrão, revisão atual):

```
┌─────────────────────────────────────┐
│ [N] Título do item                  │  ← header, bg surface2
├─────────────────────────────────────┤
│ MÉTODO                              │  ← bg surface
│ Texto descritivo do método          │
│                      TOLERÂNCIA     │
│                      ± 5 mm         │  ← badge azul (só se definida)
├─────────────────────────────────────┤
│ [✓ Conforme] [✗ Não conf.] [— N/A] │  ← bg surface2
│                                     │
│ [Painel NC — só se nok]             │
└─────────────────────────────────────┘
```

**Painel de Não Conformidade (expandido quando item = nok):**
- Borda vermelha no card inteiro
- Header do card: fundo vermelho claro
- Campo: "Descrição da não conformidade *" (textarea obrigatório)
- Campo: "Foto da evidência *" (botão câmera → thumbnail após captura)
- Campo: "Solução proposta *" (textarea obrigatório)
- Campo: "Nova data de verificação *" (DatePicker obrigatório)
- Campo: "Responsável pela correção" (Select de equipes)
- Badge "Obrigatório" no header do painel

### Seção 6: Fotos de Evidência (geral)
- Botões: [📷 Câmera] [🖼 Galeria]
- Grid 3 colunas de miniaturas com botão X para remover
- Contador: "X de 10 fotos"
- Toque na miniatura: viewer fullscreen

### Seção 7: Observações Gerais
- Textarea livre
- Placeholder: "Ocorrências, condições do ambiente..."

### Seção 8: Conclusão
- 3 botões: [✓ Conforme] [✗ Não conforme] [→ Em andamento]
- Seleção visual (destaca o botão escolhido na cor correspondente)

### Seção 9: Assinatura Digital
- Label: "Responsável: [nome do inspetor]"
- Canvas de assinatura (react-native-signature-canvas)
  - Fundo branco, traço #1a1a1a, strokeWidth 2
  - Toolbar abaixo: "Assine com o dedo" + botão "Limpar"
- Após confirmar: mostra preview + "✓ Assinatura registrada"
- Botão "Refazer" permite limpar

### Botão Salvar
- "Salvar Verificação" — fixo no final, bg --color-brand
- **Validações antes de salvar:**
  - Pelo menos uma equipe selecionada
  - Todos os itens NC com todos os campos obrigatórios preenchidos
  - Todos os itens NC com pelo menos 1 foto
  - Conclusão selecionada
  - Assinatura confirmada
- Se inválido: scroll até o primeiro campo faltando + highlight vermelho
- Loading state durante save
- **Comportamento offline:** salva em SQLite local, enfileira upload de fotos, sincroniza quando conectar

### Fluxo de Upload de Fotos (offline-first)
```
1. Foto capturada → salva em AsyncStorage local (base64 ou file path)
2. Ao salvar verificação → registra verificacao_fotos com r2_key = 'pending_[uuid]'
3. PowerSync sync queue → detecta r2_key 'pending_' → dispara upload para R2
4. Após upload bem-sucedido → atualiza r2_key com URL definitiva
```

---

## Tela 8: NC Abertas

**Arquivo:** `app/(app)/(tabs)/nc/index.tsx`

### Header
- "Não Conformidades"
- Subtítulo: "[n] abertas · [m] resolvidas"

### Filtros
- Chips: Abertas | Resolvidas | Todas

### Seção "Abertas — ação necessária"
Cards vermelhos por NC:
- Nome do serviço + item em NC
- Obra + ambiente
- Prazo (badge: "Vence hoje" em vermelho, "X dias" em laranja, data normal)
- Responsável pela correção
- Botão "Re-inspecionar" → navega para Nova Verificação da FVS correspondente

### Seção "Resolvidas recentemente"
Mesmos cards, opacidade reduzida, badge verde

---

## Tela 9: Perfil

**Arquivo:** `app/(app)/(tabs)/perfil/index.tsx`

### Hero Section
- Background: `--color-brand` 
- Avatar grande (72px) com iniciais
- Nome completo, cargo/empresa

### Dados do Usuário (lista de linhas)
- Nome completo
- Empresa
- E-mail
- Celular
- Perfil de acesso

### Estatísticas
- Grid 2x2: Obras ativas, Total verificações, Conformes, NC abertas

### Obras com Acesso
- Lista de obras habilitadas

### Botão Sair
- Chama `supabase.auth.signOut()` + limpa PowerSync

---

## Componentes Compartilhados

### `StatusBadge`
Props: `status: 'conforme' | 'nok' | 'pg' | 'na' | 'pending'`

### `ProgressBar`
Props: `value: number (0-100), variant?: 'brand' | 'ok' | 'nok'`

### `ChecklistItem`
Props: `item, resultado, onResultChange, onNCChange`
Gerencia internamente a expansão do painel de NC.

### `PhotoGrid`
Props: `photos, onAdd, onRemove, onPress`
Upload offline-first com fila.

### `SignatureCanvas`
Wrapper de react-native-signature-canvas com toolbar PrumoQ.

### `SyncStatusBar`
Banner condicional de status offline/sincronizando.

### `VerificationTimeline`
Renderiza a timeline de verificações com NC inline.

---

## Tratamento de Erros e Edge Cases

- **Verificação salva offline:** badge "Aguardando sync" na timeline
- **Upload de foto falhou:** retry automático + indicador na miniatura
- **Conflito de sync:** última modificação vence (last-write-wins)
- **Sessão expirada:** redirect para login, dados offline preservados
- **Câmera sem permissão:** dialog explicativo com link para configurações
- **Espaço insuficiente:** alert antes de tirar fotos

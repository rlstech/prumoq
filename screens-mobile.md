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
  │   │                           ├── [verificacaoId].tsx → Registro completo
  │   │                           └── nova.tsx             → Nova verificação
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

### Resumo compacto
- Uma única superfície branca com percentual e barra de progresso da obra
- Linha de apoio: FVS concluídas/total, ambientes e NC abertas
- Engenheiro responsável aparece como contexto secundário quando informado
- Nome e local da obra permanecem somente no header

### Filtros
- Chips horizontais: Todos | Internos | Externos | Com NC
- Filtragem local (sem nova query)

### Lista editorial de Ambientes
- Registros dentro de uma única superfície, separados por linhas sutis
- No mobile: nome, tipo/localização, FVS concluídas/total, barra e situação
- No tablet/PWA: colunas Ambiente, Localização, Progresso e Situação
- Datum vertical identifica NC, conclusão, andamento ou ausência de serviços
- NC usa ícone + texto; tipo do ambiente não usa badge
- Chevron comunica navegação para os serviços

---

## Tela 5: FVS do Ambiente

**Arquivo:** `app/(app)/(tabs)/obras/[id]/ambiente/[ambId]/index.tsx`

### Header
- Voltar + nome do ambiente + tipo + obra

### Resumo compacto
- Percentual e barra de progresso geral do ambiente
- Linha de apoio: concluídas/total, em curso e serviços com atenção
- Tipo, localização e obra permanecem somente no header

### Lista editorial de Serviços
- Registros dentro de uma única superfície, separados por linhas sutis
- Ícone semântico compacto + datum vertical de estado
- Nome do serviço e data da última verificação (ou "Não iniciado")
- Quantidade de verificações e status em texto, sem badges empilhados
- NC aberta aparece como alerta separado e prioritário
- No tablet/PWA: colunas Serviço, Última verificação, Verificações e Situação
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

### Lista de verificações
Registros compactos, mais recente primeiro:
- Card inteiro clicável com linha de datum na cor do resultado
- Número da verificação em IBM Plex Mono + badge do resultado derivado
- Data da inspeção + nome do inspetor
- Indicadores compactos de NC aberta/resolvida, fotos, assinatura e origem offline
- Chevron comunica navegação; toque abre o registro completo
- Observações, checklist, detalhes das NCs, fotos e assinatura ficam somente na
  tela dedicada de registro

### Registro completo
**Arquivo:** `app/(app)/(tabs)/obras/[id]/ambiente/[ambId]/fvs/[fvsId]/verificacao/[verificacaoId].tsx`

- Tela somente leitura acessada pela lista do histórico
- Identificação da obra, ambiente, inspetor, equipe e responsável técnico
- Resumo do checklist e resultado preservado de cada item
- NCs com descrição, solução, prazo, resolução e fotos
- Fotos gerais, observações e assinatura digital
- Voltar retorna ao mesmo histórico da FVS

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

### Seção 4: Itens de Verificação
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

### Seção 5: Fotos de Evidência (geral)
- Botões: [📷 Câmera] [🖼 Galeria]
- Grid 3 colunas de miniaturas com botão X para remover
- Contador: "X de 10 fotos"
- Toque na miniatura: viewer fullscreen

### Seção 6: Observações Gerais
- Textarea livre
- Placeholder: "Ocorrências, condições do ambiente..."

### Seção 7: Resultado
- Resultado somente leitura, calculado automaticamente pelos itens:
  - qualquer item Não conforme → verificação Não conforme
  - todos os itens Conforme ou N/A → verificação Conforme
- A FVS permanece Em andamento após salvar uma verificação, mesmo quando conforme

### Seção 8: Assinatura Digital
- Label: "Responsável: [nome do inspetor]"
- Canvas de assinatura (react-native-signature-canvas)
  - Fundo branco, traço #1a1a1a, strokeWidth 2
  - Toolbar abaixo: "Assine com o dedo" + botão "Limpar"
- Após confirmar: mostra preview + "✓ Assinatura registrada"
- Botão "Refazer" permite limpar

### Ações de salvamento
- "Salvar e continuar acompanhando" — salva a verificação e mantém a FVS em andamento
- "Salvar e concluir FVS" — disponível somente em verificação normal conforme,
  sem NC não resolvida; exige confirmação e bloqueia novas verificações
- Reinspeções sempre salvam e mantêm a FVS em andamento, mesmo ao resolver a última NC
- **Validações antes de salvar:**
  - Pelo menos uma equipe selecionada
  - Todos os itens NC com todos os campos obrigatórios preenchidos
  - Todos os itens NC com pelo menos 1 foto
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

## Tela 8: Não Conformidades

**Arquivo:** `app/(app)/(tabs)/nc/index.tsx`

### Header
- "Não Conformidades"
- Subtítulo: "[n] abertas · [m] resolvidas"

### Conteúdo
- Resumo compacto: ocorrências em acompanhamento, vencidas e previstas para hoje
- Abas sempre visíveis: Abertas | Resolvidas | Todas
- Busca por item, descrição, obra, ambiente ou responsável
- Filtros avançados de prazo e prioridade em `ModalSheet`
- Lista editorial agrupada por urgência, com linhas densas:
  - item em NC
  - obra + ambiente
  - descrição em uma linha
  - prazo/status, prioridade e responsável
- Toque em qualquer registro abre o detalhe; a listagem não expõe ações operacionais

### Detalhe da NC

**Arquivo:** `app/(app)/(tabs)/nc/[ncId].tsx`

- Resumo de status, prioridade e prazo
- Problema, solução proposta, responsável e programação
- Contexto completo: obra, ambiente, serviço, item, método, tolerância, verificação, inspetor e equipe
- Galeria de evidências da abertura
- Linha do tempo com abertura, reinspeções aprovadas/reprovadas e resolução
- Evidências e observações de cada reinspeção
- Encerramento e foto final, quando existentes
- Navegação entre ocorrências anterior/seguinte
- Metadados de auditoria
- Somente leitura
- Ação "Reinspecionar" disponível apenas para NC aberta/em correção e somente nesta tela

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
Renderiza a lista compacta de verificações e navega para o registro completo.

---

## Tratamento de Erros e Edge Cases

- **Verificação salva offline:** badge "Aguardando sync" na timeline
- **Upload de foto falhou:** retry automático + indicador na miniatura
- **Conflito de sync:** última modificação vence (last-write-wins)
- **Sessão expirada:** redirect para login, dados offline preservados
- **Câmera sem permissão:** dialog explicativo com link para configurações
- **Espaço insuficiente:** alert antes de tirar fotos

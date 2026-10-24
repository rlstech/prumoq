# PrumoQ — Design System

Os dois apps usam a identidade **Trena Suave** (desde out/2026), com tokens em
`packages/design-system`:

| App | Densidade | Tokens |
|---|---|---|
| PWA de campo (`apps/mobile`) | Campo: alvos grandes, botão de 56px | `trenaPalette`, `trenaColors`, `trenaRadius`, `trenaBorder`, `faceSymbolGeometry` (via `lib/constants.ts`) |
| Painel admin (`apps/admin`) | Mesa: controles de 44px, tabelas | `trenaPalette` (Tailwind), `tokens.css`, `seixoIconPaths`, `faceSymbolGeometry` |

A seção "Trena Suave (PWA)" define a identidade; "Trena Suave no painel admin"
diz como ela se aplica no painel. Layout e acessibilidade valem para os dois.

# Trena Suave (PWA)

## Conceito

Ferramenta de obra, não SaaS genérico. A referência é o que o inspetor carrega
no canteiro: trena amarela, nível, régua e o **prumo de face** (taco e peso
cilíndrico com a mesma largura). O app é usado sob sol, com luva e pressa, então
a prioridade é contraste máximo e alvos grandes.

- Grafite e amarelo de trena; fundo cinza-concreto e cards brancos.
- Minimalista: cartões sem borda (o branco se separa do concreto pelo tom),
  cantos de seixo (12–32px) e botões, chips e etiquetas em pílula.
- Números em fonte mono; o número principal da tela é grande (Figtree 800).
- Amarelo é escasso: ação principal, item ativo, destaque. Texto sobre amarelo
  é sempre grafite.

## Cores

| Token (`trenaPalette`) | Valor | Uso |
|---|---:|---|
| `graphite` | `#1C1F22` | Marca, cabeçalho, menu inferior, texto principal |
| `tapeYellow` | `#FFC21A` | Ação principal, item ativo, foco, peso do logo |
| `tapeYellowSoft` | `#FFF3CC` | Fundo de seleção |
| `concrete` | `#ECEAE6` | Canvas |
| `white` | `#FFFFFF` | Cards e formulários |
| `steel` | `#5B6168` | Texto secundário |
| `joint` | `#CFCBC3` | Bordas e divisores |
| `graphiteLine` | `#3A3F44` | Bordas sobre o grafite |
| `steelLight` | `#B9BEC3` | Texto secundário sobre o grafite |

| Estado | Principal | Fundo |
|---|---:|---:|
| Conforme | `#1F7A3A` | `#E6F2E9` |
| Não conforme | `#C8281E` | `#FBE9E7` |
| Atenção | `#B85400` | `#FFF0E0` |
| Sync/informação | `#2459A8` | `#E7EEF8` |
| Sincronizado sobre o grafite | `#4CC06E` | — |

No código do PWA, use `Palette`/`Colors` de `apps/mobile/lib/constants.ts`
(`Palette.accent`, `Palette.onAccent`, `Palette.onBrandLine`, `Palette.onBrandMuted`,
`Palette.successOnBrand`). `Colors.brandSignature` é o amarelo: não usar como texto
ou borda sobre fundo claro (contraste baixo); para seleção sobre branco, borda
grafite (`Colors.text`).

## Tipografia

Fontes empacotadas no app (`lib/theme/ThemeProvider.tsx`, `@expo-google-fonts`):

- **Figtree** 400–800: texto (`FontFamily.regular`…`bold`) e títulos
  (`FontFamily.display`, 800, espaçamento negativo). Sem caixa alta.
- **JetBrains Mono** 500–700 (`FontFamily.mono*`): números, percentuais, prazos,
  códigos.
- **Barlow Condensed** 700 (`FontFamily.wordmark`): só o logotipo PRUMOQ.

Estilos em `Typography`: `title` (título de tela), `heading` (título de seção),
`displayCaps` (destaque), `metric` (números), `button`, `overline` (rótulo
pequeno em caixa normal).

## Forma

- Raios (`Radius`, de `trenaRadius`): `xs` 12px (chips de ícone, miniaturas),
  `sm` 16px (campos, ladrilhos de ícone), `md` 20px (blocos internos, linhas
  tocáveis), `lg` 24px (cartões), `xl` 32px (cartões de destaque, folhas),
  `full` (botões, chips, etiquetas, abas, avatares, menu).
- Bordas: só em campos de formulário (1px `borderNormal`), área de foto
  tracejada e estados de erro. Cartões e listas não têm borda; divisores
  internos são 1px no tom do concreto. Sem sombra em card; sombra só no que
  flutua (menu, folhas).
- Botão principal: pílula de 56px; secundário em pílula no tom do concreto.

## Ícones

Pacote **Seixo**, sempre de `apps/mobile/lib/icons.tsx`, nunca direto de
`lucide-react-native`. Grade de 24, traço 1,8, pontas e junções arredondadas,
cantos internos com raio 1,5. Os mais visíveis são desenhados para o app
(`Home`, `Building2`, `AlertTriangle`, `Star`, `HardHat`, `Plumb`, `History`,
setas...); os demais vêm do Lucide com o mesmo acabamento. Mesma API do Lucide.
Ícone novo: adicione o nome ali.

## Marca: Q de face

O Q do nome com a perninha trocada por um prumo de face pendurado: cordão, taco
deitado e peso cilíndrico de fundo reto, **com a mesma largura do taco** (é o que
identifica a ferramenta; o de ponta cônica é o prumo de centro). Q, cordão e taco
na cor da tinta; peso sempre amarelo; frisos do peso só a partir de 40px.

- Geometria: `faceSymbolGeometry` (grade de 64).
- Componentes: `BrandMark` e `BrandWordmark` ("PRUMOQ", Q amarelo sobre o grafite).
- SVG: `packages/design-system/assets/prumoq-face.svg` (ladrilho) e
  `prumoq-face-mark.svg` (sem fundo).
- Ícones do app e favicon: `corepack pnpm brand:assets`
  (`apps/mobile/scripts/generate-brand-assets.mjs`, sem dependências; repete a
  geometria, então mude os dois juntos).

## Componentes de assinatura

- **Início**: prumo amarelo num círculo grafite, número da semana grande direto
  no concreto, pílulas de NC/resolvidas/conformidade, cartão amarelo "Continuar
  vistoria" e atalho em pílula para o **Histórico** (`app/(app)/(tabs)/historico.tsx`).
- **Trena** (`ProgressBar`): fita em pílula sem borda, marcas discretas a cada
  5%/10%; no cartão amarelo vira grafite com marcas amarelas.
- **Resposta do item** (`ChoiceToggle`/`ResultToggle`): três ladrilhos
  arredondados; o escolhido fica sólido na cor do estado, texto branco.
- **Etiquetas** (`Badge`, `StatusBadge`): pílulas sem borda, fundo suave.
- **Componentes Trena Suave** (`components/ui/trena.tsx`): `TapeHero` (avanço em fita sobre o grafite), `ProgressCard`, `Pill`, `FilterChips` (chips com contagem), `SearchPill`, `IconTile`, `SectionHead`, `GroupLabel`; `HeaderIconButton` no `AppHeader` (telas internas sem logotipo).
- **Verificação item a item** (`components/verification/ChecklistFocus.tsx` + `ChecklistJumpSheet.tsx`, lógica em `lib/verification/focus.ts`): um item por tela com avanço automático; a lista continua disponível.
- **Menu** (`components/FloatingTabBar.tsx`): pílula grafite solta da borda; a
  aba ativa vira pílula amarela com nome, as demais só ícone. No tablet, trilho
  vertical com a mesma linguagem.

# Trena Suave no painel admin

A mesma identidade do PWA (paleta, Figtree/JetBrains Mono, ícones Seixo, Q de
face), na densidade de mesa. Proposta aprovada no canvas
https://claude.ai/artifact/Wg15jsrBxgvQUaRoPQwpRS.

## Tokens no admin

- Tailwind (`apps/admin/tailwind.config.ts`), a partir de `trenaPalette`. As
  chaves são as antigas do Mineral (`brand`, `accent`, `bg-0/1/2`, `txt`,
  `txt-2/3`, `ok/nok/warn/pg/na`), então as telas não mudaram de classe.
  `brd-0` (divisor, tom do concreto), `brd-1` (contorno de campo), `brd-2`,
  `bg-hover` (#F6F5F2) e `on-brand` (texto secundário sobre o grafite).
- `txt-3` é `#646A71` (não `steelMuted`) para passar 4,5:1 também sobre o concreto.
- `text-sm` é 14px; raios: `rounded` 12, `md` 16 (campos), `lg` 20, `xl` 24
  (cartões), `2xl` 32 (destaques, painéis laterais), `full` (botões, chips).
- Variáveis CSS: `packages/design-system/src/tokens.css` (nomes `--prumo-*`
  históricos, valores Trena).
- Fontes empacotadas (@fontsource): Figtree Variable, JetBrains Mono 500/700,
  Barlow Condensed 700 (só o logotipo). A CSP do admin só aceita fontes locais.

## Classes base (`apps/admin/src/globals.css`)

| Classe | Uso |
|---|---|
| `prumo-primary-button` | Pílula amarela 44px, texto grafite. Uma por tela/painel. |
| `prumo-secondary-button` | Pílula branca (sobre concreto) ou `bg-bg-0` (sobre branco). |
| `prumo-row-button` | Pílula 32px em linhas de tabela e cartões. |
| `prumo-panel` | Cartão branco raio 24, sem borda nem sombra. |
| `prumo-field` | Campo raio 16, borda 1,5 junta; foco borda grafite + halo amarelo. |
| `prumo-th` | Cabeçalho de tabela: 12px semibold aço, sem caixa alta. |
| `prumo-pill` | Etiqueta em pílula sem borda (estado, prazo, contagem). |
| `prumo-tape` / `prumo-tape-on-dark` | Fita da trena (grafite com marcas amarelas / amarela sobre grafite). |
| `prumo-metric` | Números em JetBrains Mono tabular. |
| `on-brand` | Em superfícies grafite: foco passa a amarelo. |

`prumo-datum` ficou inócua (a linha lateral de 3px saiu).

## Ícones e marca

- Ícones só de `apps/admin/src/components/icons.tsx`, nunca direto de
  `lucide-react`. Os desenhados vêm de `seixoIconPaths`
  (`packages/design-system`); os demais são Lucide com traço 1,8 redondo. Mesma
  API do Lucide; ícone novo: adicione ali.
- `BrandMark` (Q de face, `faceSymbolGeometry`; `onBrand` ou `onLight`) e
  `BrandWordmark` ("PRUMO" + Q amarelo). Favicon: `apps/admin/public/icon.svg`
  (cópia de `prumoq-face.svg`).

## Componentes do painel

- **Menu** (`layout/Sidebar.tsx`): cartão grafite solto da borda (margem 12,
  raio 28), 240px; item ativo em pílula amarela com nome; contagem de NC em
  pílula vermelha (grafite com número amarelo quando ativo). Recolhido: trilho
  de 76px, ativo em círculo amarelo. No celular, gaveta.
- **Cabeçalho**: trilha leve sobre o concreto (`Header`) e `PageHeader` com
  título Figtree 800 (36px), kicker em caixa normal e ações à direita.
- **Abas** (`Tabs`): `segmented` para seções (pílula branca, ativa grafite com
  contagem amarela) e `chips` para filtros soltos.
- **Filtros** (`FilterBar`, `SearchField`, `SelectFilter`): pílulas brancas de 44px.
- **Tabelas** (`DataTable` e tabelas à mão): cartão raio 24, `prumo-th`,
  divisor 1px no tom do concreto, hover `bg-hover`.
- **Etiquetas** (`StatusBadge`): pílulas sem borda; `tipo="nc"` faz "aberta"
  virar "Aberta" (vermelho) em vez do "Pendente" de FVS.
- **Progresso** (`ProgressBar`): trena; 100% fica verde.
- **Resumo em grafite**: Visão geral e Obra usam um cartão grafite com o avanço
  das FVS em trena (`prumo-tape-on-dark`) e ladrilhos `#26292D`.
- **Painel lateral** (`Modal`, tamanhos sm/md/lg): abre pela direita, raio 32,
  título 24/800, fechar redondo; rodapé com secundário + ação amarela.
  `xl`/`full` continuam centrais.
- **Avisos** (`Toast`): pílula grafite com ícone num círculo do estado.

# Prumo Mineral (histórico)

Identidade anterior do admin (azul prumo `#163B50`, cal viva `#D8E568`,
calcário, IBM Plex, linha de datum, prumo facetado). Saiu do admin em
out/2026. `mineralPalette`, `mineralColors`, `mineralRadius` e
`prumoSymbolGeometry` ficam no pacote; `mineralMotion` e `mineralBreakpoints`
ainda são usados pelo PWA.

# Layout e acessibilidade (os dois apps)

## Layout mobile/PWA

- Header com marca, contexto e sincronização (no Início, a capa grafite).
- Navegação inferior escura e compacta; em tablet vira rail.
- Canvas com conteúdo máximo de `1440px` no PWA.
- Dashboard ordena: Hoje, ações necessárias, obras e atividade.
- Busca e filtros principais aparecem juntos; filtros avançados usam sheet.
- Nova Verificação usa duas etapas: Vistoria (contexto + checklist) e Fechamento (evidências, resultado, assinatura).
- Ações de avanço/salvar ficam fixas no rodapé.

## Layout admin

- Menu grafite solto da borda (240px; recolhido, trilho de `76px`); em telas pequenas vira gaveta.
- Trilha leve de `60px` sobre o concreto; título da tela no `PageHeader`.
- Conteúdo com largura máxima `1280px`.
- Dashboard usa portfólio em destaque e coluna de atenção.
- Tabelas têm cabeçalho sticky e estados de foco para linhas interativas.
- Detalhes usam masthead, resumo operacional e navegação local.

## Acessibilidade

- Contraste mínimo WCAG AA.
- Foco visível: contorno grafite sobre claro, amarelo sobre o grafite (`on-brand`).
- Touch target mínimo de `44px`.
- Navegação por teclado em tabelas, dialogs e ações.
- Ícone e texto acompanham todas as cores semânticas.
- Não remover outline sem substituto.
- Validar em 320, 390, 768, 1024, 1440 e 1920px.

## Referência de implementação

- Tokens: `packages/design-system/src/index.ts`
- CSS variables: `packages/design-system/src/tokens.css`
- Adapter mobile: `apps/mobile/lib/constants.ts`
- Adapter Tailwind: `apps/admin/tailwind.config.ts` (classes base em `apps/admin/src/globals.css`)
- Primitivas mobile: `apps/mobile/components/ui/`
- Primitivas web: `apps/admin/src/components/ui/`

# PrumoQ — Design System

O PrumoQ tem duas identidades visuais, com tokens no mesmo pacote
(`packages/design-system`):

| App | Identidade | Tokens |
|---|---|---|
| PWA de campo (`apps/mobile`) | **Trena** (desde out/2026) | `trenaPalette`, `trenaColors`, `trenaRadius`, `trenaBorder`, `faceSymbolGeometry` |
| Painel admin (`apps/admin`) | **Prumo Mineral** (a migrar) | `mineralPalette`, `mineralColors`, `mineralRadius`, `prumoSymbolGeometry`, `tokens.css` |

A seção Trena vem primeiro. A partir de "Prumo Mineral (admin)", o texto vale
para o painel; as seções de layout e acessibilidade valem para os dois.

# Trena (PWA)

## Conceito

Ferramenta de obra, não SaaS genérico. A referência é o que o inspetor carrega
no canteiro: trena amarela, nível, régua e o **prumo de face** (taco e peso
cilíndrico com a mesma largura). O app é usado sob sol, com luva e pressa, então
a prioridade é contraste máximo e alvos grandes.

- Grafite e amarelo de trena; fundo cinza-concreto e cards brancos.
- Bordas no lugar de sombras; cantos quase retos (3–6px).
- Números em fonte mono, grandes.
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

- **Barlow Condensed** 600/700 (`FontFamily.display`): títulos, botões, rótulos
  de seção, nomes de obra. Botões e rótulos em caixa alta.
- **Barlow** 400–700: texto.
- **JetBrains Mono** 500–700 (`FontFamily.mono*`): números, percentuais, prazos,
  códigos.

Estilos em `Typography`: `displayCaps` (saudação, títulos em caixa alta),
`metric` (números de destaque), `button`, `overline`.

## Forma

- Raios (`Radius`): `xs`/`sm` 3px (controles, etiquetas, avatares), `md`/`lg`
  4px (cards), `xl` 6px (menu inferior, superfícies grandes). Círculo só para
  pontos de status, rádio e botões sobre foto.
- Bordas (`BorderWidth`): 1,5px em cards e controles. Sem sombra em card
  (`Elevation.card` é nula); sombra só no que flutua.
- Botão principal: 52px de altura.

## Ícones

Sempre de `apps/mobile/lib/icons.tsx`, nunca direto de `lucide-react-native`.
Os mais visíveis são desenhados para o app (traço reto, cantos vivos, capacete
no Perfil); os demais vêm do Lucide com traço 2,3 e pontas retas. Mesma API do
Lucide. Ícone novo: adicione o nome ali.

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

- **Capa do Início** (`DashboardCanopy`): grafite chapado, régua na borda de
  baixo, prumo de face pendurado à direita.
- **Anel de conformidade** (`ConformityRing`): mostrador com arco amarelo e marcas
  a cada 5%.
- **Trena** (`ProgressBar`): fundo branco com borda grafite, preenchimento amarelo
  (verde quando 100%) e marcas a cada 5%/10%.
- **Etiquetas** (`StatusBadge`, prazos): retas, ponto quadrado, caixa alta. Prazo
  vencido em vermelho cheio, até 3 dias em amarelo, depois só contorno.
- **Menu inferior**: grafite, bloco amarelo atrás do ícone ativo.

# Prumo Mineral (admin)

## Conceito

O PrumoQ usa uma linguagem visual inspirada em linhas de prumo, referências de
nível, plantas técnicas e materiais minerais. A interface deve parecer precisa,
robusta e calma — nunca decorativa ou excessivamente “industrial”.

A assinatura visual é formada por:

- Azul Prumo para marca, navegação e ações primárias.
- Cal Viva para foco, seleção e pontos de referência.
- Superfícies claras e quentes para leitura prolongada.
- Linha de datum de 3px para indicar contexto ou estado.
- Cor semântica sempre acompanhada de texto e/ou ícone.

Os valores canônicos ficam em `packages/design-system`. Aplicações devem
consumir os tokens compartilhados; este documento explica como usá-los.

## Cores

### Marca e interface

| Token | Valor | Uso |
|---|---:|---|
| `plumb` | `#163B50` | Marca, navegação e ação primária |
| `plumbDeep` | `#0F2C3C` | Shell escuro e hover |
| `plumbPressed` | `#0C2533` | Estado pressionado |
| `lime` | `#D8E568` | Foco, seleção e assinatura |
| `limeSoft` | `#F3F7D5` | Fundo de seleção |
| `basalt` | `#142522` | Texto principal |
| `slate` | `#52615B` | Texto secundário |
| `mistText` | `#6E7A75` | Texto terciário |
| `limestone` | `#F4F1E8` | Canvas |
| `mineralWhite` | `#FFFEFB` | Cards e formulários |
| `fog` | `#E4E7E1` | Divisores e superfícies secundárias |
| `fogStrong` | `#C9D0CA` | Bordas de controles |

### Estados

| Estado | Principal | Fundo |
|---|---:|---:|
| Conforme | `#2D7A4B` | `#E8F4EC` |
| Não conforme | `#B23A3A` | `#FAEAEA` |
| Atenção | `#986014` | `#FBF1DD` |
| Informação/sync | `#2D66A8` | `#E9F0F8` |
| Neutro/pendente | `#52615B` | `#EEF0EC` |

Cal Viva recebe texto Basalto, nunca texto branco. Estados críticos não devem
ser comunicados apenas por cor.

## Tipografia

- Interface: IBM Plex Sans.
- Números, percentuais, revisões e códigos: IBM Plex Mono.
- Fontes são distribuídas com os aplicativos; não dependem de download em
  runtime.

| Papel | Tamanho/linha | Peso |
|---|---|---|
| Display | `40/44` web, `34/40` mobile | 700 |
| Título de página | `28/34` | 600–700 |
| Título de seção | `22/28` | 600 |
| Corpo | `15/22` mobile, `15/22` web | 400 |
| Label | `13/18` | 600 |
| Legenda | `12/16` | 400–500 |

Evitar caixa alta em títulos. Overlines e labels de seção podem usar caixa alta
com tracking entre `0.12em` e `0.16em`.

## Espaçamento, forma e movimento

- Grid: `4, 8, 12, 16, 24, 32, 48`.
- Controle: raio de `6px`.
- Card: raio de `12px`.
- Superfície protagonista: raio máximo de `20px`.
- Touch target mobile: mínimo `44px`.
- Input e ação primária mobile: `48px`.
- Motion: `120ms`, `180ms` e `220ms`.
- Respeitar `prefers-reduced-motion`.

Sombras são discretas. Use espaço, contraste e borda antes de elevar uma
superfície.

## Marca

O símbolo combina um `Q` com uma corda vertical e um peso de prumo facetado na
base. A gravidade organiza a forma: a corda nunca é inclinada e o peso sempre
fica abaixo do centro óptico.
Ele aparece no favicon, ícone do app, splash, login e navegação.

Não desenhar novas variações do símbolo em telas. Usar os ativos canônicos em
`packages/design-system/assets`, os componentes `BrandMark` e os derivados em
`apps/admin/public/icon.svg` e `apps/mobile/assets`.

## Componentes

### Linha de datum

Linha vertical de 3px no lado esquerdo. Cal Viva representa contexto ou marca;
cores semânticas representam estados. Evitar barras coloridas no topo e fundos
inteiros saturados.

### Botões

- Primário: Azul Prumo, texto branco.
- Secundário: superfície branca, borda forte, texto Basalto.
- Destrutivo: vermelho semântico.
- Ghost: sem fundo; hover usa Fog.
- Apenas uma ação primária por superfície.

### Controle de resposta (ChoiceToggle)

Controle único de 2–3 posições, 56px de altura, ícone sobre rótulo, **todas as
posições com a mesma largura** — nenhuma resposta pode ser mais difícil de
acertar que outra. A posição escolhida carrega três sinais somados: fundo em
tint suave, anel semântico de 1,5px e o glifo circular **preenchido**, enquanto
as demais permanecem em contorno.

O preenchimento do glifo é o sinal que sobrevive ao sol direto e continua legível
em escala de cinza; o tint sozinho é um degrau de cerca de 4% de luminância e
desaparece em campo. As posições não escolhidas recuam para Névoa assim que
existe resposta.

Isso substitui a marcação anterior por barra de 3px na base, que era fraca demais
para uso externo. Preenchimento de glifo não conflita com a regra de fundos
saturados: o bloco de cor tem o tamanho de um ícone, não de uma superfície.

### Status

Badges usam ponto/ícone, texto, fundo suave e borda. NCs usam card branco com
datum vermelho em vez de um card inteiramente vermelho.

### Cards e métricas

Cards padrão têm superfície Mineral White, borda Fog e sombra mínima. Métricas
usam IBM Plex Mono e hierarquia assimétrica; não criar grades de cartões
idênticos quando uma informação tem prioridade maior.

### Formulários

Labels ficam acima dos campos. Foco usa borda Azul Prumo e halo Cal Viva. Erros
aparecem inline e também em resumos navegáveis para formulários longos.

No admin, formulários simples abrem em side sheet. Modais centrais ficam
reservados a confirmação, visualização ampla e fluxos concentrados.

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

- Rail principal de `88px`; em telas pequenas vira drawer.
- Command/header de `72px`.
- Canvas em grid de 12 colunas, largura máxima `1440px`.
- Dashboard usa portfólio em destaque e coluna de atenção.
- Tabelas têm cabeçalho sticky e estados de foco para linhas interativas.
- Detalhes usam masthead, resumo operacional e navegação local.

## Acessibilidade

- Contraste mínimo WCAG AA.
- Foco visível com Cal Viva.
- Touch target mínimo de `44px`.
- Navegação por teclado em tabelas, dialogs e ações.
- Ícone e texto acompanham todas as cores semânticas.
- Não remover outline sem substituto.
- Validar em 320, 390, 768, 1024, 1440 e 1920px.

## Referência de implementação

- Tokens: `packages/design-system/src/index.ts`
- CSS variables: `packages/design-system/src/tokens.css`
- Adapter mobile: `apps/mobile/lib/constants.ts`
- Adapter Tailwind: `apps/admin/tailwind.config.ts`
- Primitivas mobile: `apps/mobile/components/ui/`
- Primitivas web: `apps/admin/src/components/ui/`

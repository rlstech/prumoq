# PrumoQ — Design System “Prumo Mineral”

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
`apps/web/app/icon.svg` e `apps/mobile/assets`.

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

## Layout mobile/PWA

- Header claro com marca, contexto e sincronização.
- Navegação inferior escura e compacta; em tablet vira rail.
- Canvas Calcário com conteúdo máximo de `1440px` no PWA.
- Dashboard ordena: Hoje, ações necessárias, obras e atividade.
- Busca e filtros principais aparecem juntos; filtros avançados usam sheet.
- Nova Verificação usa quatro etapas: Contexto, Checklist, Evidências e Revisão.
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
- Adapter Tailwind: `apps/web/tailwind.config.ts`
- Primitivas mobile: `apps/mobile/components/ui/`
- Primitivas web: `apps/web/components/ui/`

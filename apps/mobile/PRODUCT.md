# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Inspetores de campo (perfis `inspetor`, `admin` e `gestor` — os três acessam o mobile;
`inspetor` é exclusivo do mobile, bloqueado no painel web) registrando verificações de
qualidade em obras de construção civil. Uso típico: em campo, muitas vezes offline ou
com conexão instável, sob sol, com luva, frequentemente com uma mão só enquanto seguram
prancheta/EPI com a outra.

## Product Purpose

PrumoQ Mobile substitui o checklist de qualidade em papel por um app 100% funcional
offline: o inspetor percorre Obra → Ambiente → FVS (Ficha de Verificação de Serviço) →
Verificação, classifica cada item do checklist (Conforme / Não conforme / N/A), anexa
fotos de evidência, abre Não Conformidade quando aplicável e assina digitalmente. Todo
write passa por sync local-first (PowerSync); nada depende de estar online no momento
do registro.

## Positioning

Diferencial não é "ter versão mobile" — é offline-first de verdade: todo write vai
primeiro para SQLite local (PowerSync) e sincroniza quando há rede, incluindo fotos
(upload resiliente via URL pré-assinada do Cloudflare R2, com fila de pendências
`pending:` até o upload confirmar). Concorrentes de checklist de obra tipicamente
exigem conexão para registrar ou usam formulário web adaptado, não um app nativo
desenhado para o cenário de campo.

## Operating Context

- Canteiro de obra: luz solar direta, uso com luva/mão suja, muitas vezes uma mão só.
- Conectividade instável ou ausente — o app roda também como PWA no browser (via shim
  que mapeia as mesmas queries para Supabase REST), mas o alvo primário é o app nativo
  (Expo Router + PowerSync).
- Fluxo hierárquico fixo: Empresa → Obra → Equipe/Ambiente → FVS Planejada → Verificação.
- Verificação com Não Conformidade exige descrição + foto + solução + prazo +
  responsável (RN-01) antes de poder ser salva.
- NC só fecha com reinspeção conforme (RN-02); alguns campos ficam travados/mantidos
  nesse modo.
- Acesso escopado por obra via RLS (RN-08) — inspetor só vê as obras habilitadas para
  ele.
- Assinatura digital obrigatória para concluir uma verificação.

## Capabilities and Constraints

- Expo SDK 52 + Expo Router (roteamento por arquivo), React Native 0.76.
- PowerSync (`@powersync/react-native`) para sync local-first; `db.execute()` para
  writes offline; `usePowerSyncQuery`/`useQuery` para leitura reativa.
- Também roda como PWA (`apps/mobile/lib/powersync-web-shim.ts` mapeia as mesmas
  queries SQL para chamadas Supabase REST) — mesmo código de tela serve nativo e web.
- Upload de fotos sempre via presigned URL (Edge Function R2); nunca upload direto.
- Assinatura digital: campo dedicado, obrigatório para concluir.
- Progresso (ambiente/obra) é calculado automaticamente por trigger no banco, não no
  cliente.
- 100% StyleSheet-based; NativeWind está configurado mas não é usado — não introduzir
  Tailwind neste app.
- Ícones: Lucide React Native, nunca emoji.
- Tipografia: IBM Plex Sans (interface) e IBM Plex Mono (números, percentuais,
  revisões, códigos) — distribuídas com o app, sem dependência de rede.

## Brand Commitments

Sistema "Prumo Mineral" (`design-system.md`, `packages/design-system/`) é a referência
visual definitiva — vale para nativo e PWA:

- Azul Prumo `#163B50` — marca, navegação, ação primária.
- Cal Viva `#D8E568` — foco, seleção, assinatura; **recebe texto Basalto, nunca texto
  branco**.
- Calcário `#F4F1E8` — canvas; Mineral White `#FFFEFB` — cards/formulários.
- Linha de "datum" de 3px na borda esquerda de um card branco para indicar contexto ou
  estado — nunca fundo inteiro saturado (ex.: NC = card branco + datum vermelho, nunca
  card vermelho).
- Sem grades de cartões de métricas idênticos quando uma informação tem prioridade
  maior.
- Marca (símbolo `Q` com corda e peso de prumo facetado) só a partir dos ativos
  canônicos em `packages/design-system/assets` — não redesenhar.
- Platform gravado como `web` deliberadamente, apesar do build nativo via Expo: o app
  não segue HIG (iOS) nem Material Design 3 (Android) — usa um único sistema visual
  custom (Prumo Mineral) idêntico em nativo e PWA, sem adaptação por SO. Reabrir essa
  decisão exige mudança explícita do usuário, não inferência de uma sessão futura.

## Evidence on Hand

- `design-system.md` — cores, tipografia, espaçamento, componentes e padrões visuais
  canônicos (fonte de verdade, sobrepõe os protótipos HTML em cores/tipografia/shell).
- `references/prumoq_mobile_inspector.html` — protótipo de fluxo e conteúdo do app
  mobile (válido para fluxo, não para cores/tipografia/shell).
- `screens-mobile.md` — especificação tela a tela do app.
- Nenhum caso de uso, depoimento, benchmark ou dado de cliente real disponível — não
  inventar para telas de marketing/onboarding.

## Product Principles

1. Offline nunca é um estado de erro — é o estado normal de uso em obra.
2. Cor semântica sempre acompanhada de texto e/ou ícone; nunca só cor.
3. Uma ação primária por tela/superfície; navegação e ações de avanço ficam fixas no
   rodapé.
4. Densidade > decoração: o inspetor percorre listas longas de itens de checklist em
   campo; cada tela deve minimizar rolagem sem esconder informação obrigatória.
5. Nada de mudança visual que altere o formato do rascunho local (`VerificationDraftV1`)
   ou as strings SQL consumidas pelo shim PWA sem migração deliberada.

## Accessibility & Inclusion

- Contraste mínimo WCAG AA; foco visível com Cal Viva; touch target mínimo 44px
  (48px em input e ação primária mobile).
- Cor semântica sempre acompanhada de ícone/texto (uso com luva/sol reduz precisão de
  toque e leitura de cor).
- Validar em 320, 390, 768, 1024, 1440 e 1920px (cobre phone a tablet/rail PWA).

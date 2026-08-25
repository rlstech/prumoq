---
name: PrumoQ Mobile
description: PWA de inspeção de qualidade em campo, precisa e legível sob pressão.
colors:
  plumb: "#163B50"
  lime: "#D8E568"
  limestone: "#F4F1E8"
  mineral-white: "#FFFEFB"
  basalt: "#142522"
  slate: "#52615B"
  fog: "#E4E7E1"
  success: "#2D7A4B"
  danger: "#B23A3A"
typography:
  title:
    fontFamily: "IBM Plex Sans"
    fontSize: "26px"
    fontWeight: 700
    lineHeight: "32px"
  body:
    fontFamily: "IBM Plex Sans"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: "24px"
  label:
    fontFamily: "IBM Plex Sans"
    fontSize: "14px"
    fontWeight: 600
    lineHeight: "20px"
rounded:
  control: "6px"
  card: "12px"
  feature: "20px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "20px"
  xxl: "24px"
components:
  button-primary:
    backgroundColor: "{colors.plumb}"
    textColor: "#FFFFFF"
    rounded: "{rounded.control}"
    height: "48px"
  card-default:
    backgroundColor: "{colors.mineral-white}"
    rounded: "{rounded.card}"
    padding: "{spacing.lg}"
---

## Overview

**Creative North Star: "Linha de Controle"**

PrumoQ Mobile é um instrumento de campo: claro sob sol, denso sem parecer apertado e seguro quando o inspetor opera com atenção fragmentada. A nova assinatura é o monograma PQ, uma construção geométrica de duas letras com o corte Cal Viva reservado à precisão e à ação atual.

**Key Characteristics:**
- Superfícies minerais claras, estrutura Azul Prumo e uma única ênfase Cal Viva.
- Dados, ordens e progresso usam IBM Plex Mono; a leitura operacional usa IBM Plex Sans.
- A rota do checklist revela o estado do serviço sem alterar a lógica offline.

## Colors

Azul Prumo estrutura navegação e decisões primárias; Cal Viva indica foco, seleção e a parada prioritária. Estados críticos continuam semânticos e sempre têm rótulo ou ícone.

**The One Accent Rule.** Cal Viva nunca ocupa uma superfície inteira de trabalho: ele marca uma ação, uma seleção ou uma referência de precisão.

## Typography

**Display Font:** IBM Plex Sans
**Body Font:** IBM Plex Sans
**Label/Mono Font:** IBM Plex Mono

Títulos têm peso forte e frase natural; números de ordem, proporções, datas compactas e estados de rota usam a família monoespaçada apenas quando carregam dado operacional.

## Layout

O conteúdo usa o ritmo de 4, 8, 12, 16, 20, 24 e 32px. A partir de 768px, a rota de vistoria ocupa uma coluna lateral de 224px e o checklist preserva uma coluna de leitura flexível. Abaixo desse ponto, a rota se torna uma faixa compacta antes dos filtros do checklist.

## Elevation & Depth

Profundidade é discreta: bordas Fog e superfícies Mineral White definem grupos; sombras suaves aparecem apenas em cards que se destacam do canvas. A rota e os controles de resposta permanecem planos para não competir com o item inspecionado.

## Shapes

Controles usam raio de 6px; cards e listas usam 12px; superfícies protagonistas podem chegar a 20px. Pills são reservadas para badges e indicadores curtos. O monograma PQ é geométrico, compacto e nunca substitui texto de navegação.

## Components

### Buttons

Primário em Azul Prumo, 48px de altura e texto branco. Secundário usa superfície clara e borda; foco combina borda Azul Prumo e halo Cal Viva.

### Cards / Containers

Cards usam Mineral White, borda Fog e espaçamento interno de 16px. Não usar fundos semânticos saturados para uma NC; o estado é comunicado por ícone, texto e tom semântico.

### Navigation

A fase Vistoria/Fechamento mantém o stepper de duas etapas. A rota do checklist é a navegação de detalhe: rail à esquerda em tablet/PWA amplo e faixa de progresso compacta em celular.

### Checklist Route

Cada parada mostra ordem, título e estado. A próxima pendência recebe Cal Viva; uma NC aberta assume prioridade e vermelho semântico. A rota é derivada do mesmo rascunho local do checklist.

## Do's and Don'ts

### Do:
- **Do** usar o monograma PQ em ícones, splash e cabeçalhos compactos do mobile/PWA.
- **Do** manter ações de decisão grandes, com texto, ícone e contraste suficiente para uso em campo.
- **Do** adaptar a rota para faixa superior compacta antes de sacrificar largura de conteúdo no celular.

### Don't:
- **Don't** alterar a estrutura do rascunho, consultas ou regras de reinspeção para uma mudança visual.
- **Don't** usar a cor como único indicador de resultado ou prioridade.
- **Don't** aplicar o monograma novo ao painel web até uma iniciativa de marca compartilhada.

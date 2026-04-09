# PrumoQ — Design System

## Filosofia

Interface limpa, industrial e funcional. Sem decoração excessiva. Cada elemento tem propósito.
O laranja `#E84A1A` é a cor da marca — usada para ações primárias e destaques. Verde para conformidade, vermelho para não conformidade, azul para progresso.

---

## Paleta de Cores

### Marca
```
--color-brand:        #E84A1A   /* laranja principal */
--color-brand-dark:   #C03A10   /* hover/pressed */
--color-brand-light:  #FDF0EC   /* backgrounds suaves */
--color-brand-mid:    #F5784A   /* avatares, ícones secundários */
```

### Semântica
```
--color-ok:           #2E7D32   /* conforme / sucesso */
--color-ok-bg:        #E8F5E9
--color-ok-mid:       #4CAF50   /* barras de progresso concluídas */

--color-nok:          #C62828   /* não conforme / erro */
--color-nok-bg:       #FFEBEE

--color-progress:     #1565C0   /* em andamento / info */
--color-progress-bg:  #E3F2FD

--color-warn:         #E65100   /* alertas / prazo próximo */
--color-warn-bg:      #FFF3E0

--color-na:           #666666   /* N/A / inativo / pendente */
--color-na-bg:        #F2F2F2
```

### Interface (Web Admin)
```
--bg-0:     #F7F6F3   /* fundo da página */
--bg-1:     #FFFFFF   /* superfície de cards */
--bg-2:     #F1EFE8   /* hover, inputs, secundário */
--txt:      #1A1A18   /* texto principal */
--txt-2:    #5C5B57   /* texto secundário */
--txt-3:    #9C9A93   /* texto terciário, placeholders */
--border-0: rgba(0,0,0,0.08)   /* bordas sutis */
--border-1: rgba(0,0,0,0.12)   /* bordas normais */
```

### Interface (Mobile App)
As mesmas variáveis de cor acima, adaptadas para React Native:
```typescript
export const colors = {
  brand:         '#E84A1A',
  brandDark:     '#C03A10',
  brandLight:    '#FDF0EC',
  ok:            '#2E7D32',
  okBg:          '#E8F5E9',
  nok:           '#C62828',
  nokBg:         '#FFEBEE',
  progress:      '#1565C0',
  progressBg:    '#E3F2FD',
  warn:          '#E65100',
  warnBg:        '#FFF3E0',
  na:            '#666666',
  naBg:          '#F2F2F2',
  bg:            '#F7F6F3',
  surface:       '#FFFFFF',
  surface2:      '#F1EFE8',
  text:          '#1A1A18',
  textSecondary: '#5C5B57',
  textTertiary:  '#9C9A93',
  border:        'rgba(0,0,0,0.08)',
  borderMid:     'rgba(0,0,0,0.12)',
}
```

---

## Tipografia

### Web Admin
```css
font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;

/* Escalas */
--text-xs:   11px
--text-sm:   12px
--text-base: 13px / 14px
--text-md:   15px
--text-lg:   16px / 17px
--text-xl:   18px / 19px
--text-2xl:  20px / 22px
--text-3xl:  26px / 28px

/* Pesos */
--weight-normal: 400
--weight-medium: 500
--weight-semi:   600

/* Títulos de página */
page-title: 20px, weight 600
section-title: 11px, weight 600, uppercase, letter-spacing 0.5px, color txt-2

/* Células de tabela */
table-header: 11px, weight 600, uppercase, letter-spacing 0.4px
table-cell: 13px, weight 400
table-cell-sub: 12px, color txt-2, margin-top 2px
```

### Mobile App
```typescript
export const fonts = {
  // títulos de tela
  screenTitle:  { fontSize: 19, fontWeight: '500' as const },
  // subtítulos
  subtitle:     { fontSize: 12 },
  // cards
  cardTitle:    { fontSize: 14, fontWeight: '500' as const },
  cardSubtitle: { fontSize: 12 },
  // checklist
  itemTitle:    { fontSize: 13, fontWeight: '500' as const },
  itemMethod:   { fontSize: 12 },
  // labels de formulário
  formLabel:    { fontSize: 12, fontWeight: '500' as const },
  // botões
  button:       { fontSize: 14, fontWeight: '500' as const },
  // badges
  badge:        { fontSize: 11, fontWeight: '500' as const },
  // seções
  sectionLabel: { fontSize: 11, fontWeight: '600' as const },
}
```

---

## Espaçamento

```
4px  — gap mínimo entre elementos inline
8px  — padding interno de badges, chips
10px — gap padrão em grids mobile
12px — padding de cards mobile, gap em grids
14px — padding de conteúdo mobile
16px — padding de cards web
20px — padding de seções web
24px — padding de página web
```

### Bordas e Raios
```
border-radius-sm:  6px  (itens de checklist, inputs)
border-radius-md:  8px  (cards menores, badges grandes, modais)
border-radius-lg: 12px  (cards principais, sheets mobile)
border-radius-xl: 16px  (modais web)
border-radius-full: 9999px (badges, chips, avatares)

border-width: 0.5px (mobile) / 1px (web)
border-width-accent: 3px (destaques de ambientes por tipo)
```

---

## Componentes

### Badges de Status
Sempre com texto + fundo na mesma família de cor.
```
Conforme:       bg #E8F5E9, text #2E7D32, border (mobile) #2E7D32
Não conforme:   bg #FFEBEE, text #C62828, border (mobile) #C62828
Em andamento:   bg #E3F2FD, text #1565C0
Pendente / N/A: bg #F2F2F2, text #666666
Vence hoje:     bg #FFEBEE, text #C62828
Prazo próximo:  bg #FFF3E0, text #E65100
```

### Barras de Progresso
```
height: 6px (mobile) / 6px (web)
border-radius: 3px
background-track: --color-border / --bg-2
fill-em-andamento: --color-brand
fill-concluida:    --color-ok
fill-nao-conforme: --color-nok
```

### Avatares
```
admin / brand:   bg --color-brand-light,  text --color-brand,    initials
engenheiro:      bg --color-progress-bg,  text --color-progress, initials
proprio:         bg --color-ok-bg,        text --color-ok,       initials
terceirizado:    bg --color-warn-bg,      text --color-warn,     initials
inspetor:        bg --color-brand-light,  text --color-brand,    initials

Sizes: 28px (inline), 32px (tabela), 36px (team rows), 40px (profile card), 72px (perfil hero)
```

### Itens de Checklist (Mobile)
```
container: border 0.5px, border-radius 8px, overflow hidden
header: background --surface2, padding 11px 13px
  - número: círculo 20px, bg --border, font 11px weight 500
  - título: font 13px weight 500
método/tolerância: background --surface, padding 9px 13px, border-top 0.5px
  - label: font 10px weight 600, uppercase, letter-spacing 0.4px, color --textSecondary
  - tolerância: badge azul (progressBg/progress), font 12px weight 500
ações: background --surface2, padding 10px 13px, border-top 0.5px
  - botões C/NC/NA: flex igual, padding 8px, border-radius 5px, font 11px weight 500
```

### Painel de Não Conformidade (Mobile)
```
Quando item marcado como NC, exibe painel com:
- background: --color-nok-bg
- border: 0.5px solid --color-nok
- border-radius: 8px
- padding: 12px
Campos obrigatórios:
  1. Textarea: descrição da NC
  2. Foto: botão dashed, após upload mostra thumbnail 52px
  3. Textarea: solução proposta
  4. Date input: nova data de verificação
  5. Select: responsável pela correção
```

### Cartão de Ambiente (Web)
```
border-top accent 3px:
  - interno: #1565C0 (azul)
  - externo: #2E7D32 (verde)
border: 0.5px solid --border-0
border-radius: 12px
hover: border-color --color-brand, box-shadow sutil
```

### Toggle (Web)
```
track: width 36px, height 20px, border-radius 10px
  - unchecked: background #ccc
  - checked:   background --color-ok
thumb: width 16px, height 16px, border-radius 50%, background white
  - transition: left 0.2s
```

### Topbar Mobile
```
background: --color-brand
padding: 13px 18px 17px (normal) / 12px 18px 16px (compact)
h1: color white, font 18-19px, weight 500
p: color rgba(255,255,255,0.72), font 12px
back button: background rgba(255,255,255,0.2), width/height 32px, border-radius 50%
```

### Bottom Nav Mobile
```
height: 76px (inclui safe area de 8px no bottom)
background: surface
border-top: 0.5px solid border
itens: 4 botões iguais, flex-direction column, ícone 19px + label 10px
ativo: color --color-brand, weight 500
inativo: color --textSecondary
```

### Sidebar Web
```
width: 228px
background: #1A1A18 (--txt, quase preto)
sb-item normal:  color rgba(255,255,255,0.65), padding 9px 12px, border-radius 7px
sb-item hover:   background rgba(255,255,255,0.06)
sb-item active:  background --color-brand, color white
section labels:  color rgba(255,255,255,0.3), font 10px uppercase
badge de alerta: background --color-nok, color white, font 10px weight 600
```

---

## Ícones

Usar **Lucide React** / **Lucide React Native** em todo o sistema.

Ícones principais por contexto:
```
Dashboard:          LayoutGrid
Obras:              Building2
FVS Padrão:         ClipboardList
Ambientes:          Layers
Equipes:            HardHat
Usuários:           User
Verificações:       Search / ScanLine
NC:                 AlertTriangle
Relatórios:         BarChart2
Config:             Settings
Logout:             LogOut
Foto:               Camera / Image
Assinatura:         PenLine
Download / PDF:     Download / FileDown
Conforme:           CheckCircle2
Não Conforme:       XCircle
N/A:                MinusCircle
Progresso:          Clock
Interno:            Home
Externo:            Sun
NC Aberta:          AlertCircle
NC Resolvida:       CheckCircle
Voltar:             ChevronLeft
Adicionar:          Plus
```

---

## Animações e Transições

```
Transições de cor/borda:  0.12s ease
Toggle switch:            0.2s ease
Barra de progresso:       0.3s ease
Toast entrada/saída:      translateY + opacity, 0.25s
Modal entrada:            opacity + scale, 0.2s

Mobile - Sheet de verificação:
  entrada: translateY(100%) → translateY(0), 0.3s ease-out
  saída:   translateY(0) → translateY(100%), 0.25s ease-in
```

---

## Padrões de Layout

### Web Admin — Grid de KPIs
```css
display: grid;
grid-template-columns: repeat(4, 1fr);
gap: 14px;
margin-bottom: 24px;
```

### Web Admin — Detalhe com Sidebar
```css
display: grid;
grid-template-columns: 1fr 340px;
gap: 20px;
```

### Mobile — Grid de Ambientes
```css
/* React Native */
numColumns: 2
columnWrapperStyle: { gap: 10 }
```

### Mobile — Grid de Fotos
```
3 colunas, gap 6px, aspect-ratio 1:1
```

---

## Referências Visuais

Os arquivos HTML dos protótipos são a referência definitiva de layout. Qualquer dúvida sobre espaçamento, hierarquia ou comportamento, consultar:

- `references/fvs_admin_prumoq.html` — Painel web administrativo completo
- `references/mobile-prototype.html` — App mobile com todas as telas

**O design dos protótipos deve ser reproduzido fielmente.**
Desvios só são aceitáveis quando tecnicamente necessários para React Native / Next.js.

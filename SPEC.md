# PrumoQ — Especificação Técnica do Produto

## Visão Geral

**PrumoQ** é uma plataforma de gestão da qualidade para obras de construção civil. O sistema permite que empresas de engenharia cadastrem obras, ambientes e fichas de verificação de serviços (FVS) pelo painel web administrativo, e que inspetores de campo registrem verificações pelo app mobile — com suporte completo a uso offline.

**Domínio:** prumoq.com.br  
**Versão inicial:** 1.0 (módulo FVS)  
**Módulos futuros previstos:** Diário de Obra, Controle de Materiais, Gestão de RNCs, Auditorias ISO

---

## Stack Tecnológica

| Camada | Tecnologia | Justificativa |
|---|---|---|
| Mobile | React Native + Expo SDK 51+ | Compartilha lógica com web, suporte nativo a câmera/assinatura |
| Web Admin | Next.js 14 + TypeScript | SSR, App Router, componentes React compartilhados |
| Banco de dados | Supabase (PostgreSQL 15) | Auth integrada, RLS, realtime, open-source |
| Offline + Sync | PowerSync | SQLite local no device, sync automático, conflict resolution |
| Armazenamento | Cloudflare R2 | S3-compatible, sem egress fee, presigned URLs |
| Auth | Supabase Auth | JWT, perfis, Row Level Security por obra |
| PDF | React PDF (client) + Puppeteer (server) | FVS impressa com fotos e assinatura |
| Deploy Web | Vercel | CI/CD automático, Edge Functions |
| Deploy Mobile | Expo EAS Build | OTA updates, builds iOS/Android |

---

## Personas e Perfis de Acesso

### Administrador
- Acesso total ao painel web
- Cadastra empresas, obras, ambientes, FVS padrão, equipes e usuários
- Define quais obras cada usuário pode acessar
- Visualiza todos os relatórios e verificações

### Gestor
- Acesso ao painel web com escopo limitado às suas obras
- Pode cadastrar ambientes e associar FVS
- Visualiza relatórios e NC das suas obras
- Não pode cadastrar empresas nem gerenciar usuários

### Inspetor
- Acesso somente ao app mobile
- Visualiza apenas as obras para as quais foi habilitado
- Registra verificações, fotos e assinatura digital
- Consulta histórico de verificações e NC abertas

---

## Hierarquia de Dados

```
Empresa
  └── Obra
        ├── Equipe (Engenheiro + Inspetores + Equipes executoras)
        └── Ambiente (Interno | Externo)
              └── FVS Planejada (vinculada a uma FVS Padrão)
                    └── Verificação (entrada no histórico)
                          ├── Itens de verificação (Conforme | Não conforme | N/A)
                          ├── Não Conformidade (quando item = Não conforme)
                          │     ├── Foto de evidência (obrigatória)
                          │     ├── Descrição + Solução proposta
                          │     └── Prazo + Responsável pela correção
                          ├── Fotos gerais de evidência
                          └── Assinatura digital do inspetor
```

### FVS Padrão (biblioteca da empresa)
```
FVS Padrão
  ├── Metadados (nome, categoria, norma, status ativo/inativo)
  ├── Revisões (histórico com descrição de alterações)
  └── Itens de verificação
        ├── Título do item
        ├── Método de verificação (texto descritivo)
        └── Tolerância (opcional, ex: "± 5 mm", "1 cm / 5 m")
```

---

## Regras de Negócio Críticas

### RN-01: Item Não Conforme obriga registro completo
Quando um item de verificação é marcado como **Não conforme**:
- Campo "Descrição da não conformidade" torna-se **obrigatório**
- Pelo menos **1 foto de evidência** é **obrigatória**
- Campo "Solução proposta" é **obrigatório**
- Campo "Nova data de verificação" é **obrigatório**
- Campo "Responsável pela correção" é **obrigatório**
- A verificação só pode ser salva com todos esses campos preenchidos

### RN-02: Re-inspeção fecha a NC
Uma NC só pode ser marcada como **Resolvida** quando:
- Uma nova verificação é criada para o mesmo serviço/ambiente
- O item anteriormente não conforme é marcado como **Conforme**
- A resolução é registrada com referência à NC original

### RN-03: Inspetor é definido pelo login
O campo "Responsável pela verificação" é sempre preenchido automaticamente com o usuário logado. Não é editável.

### RN-04: FVS Padrão com revisão
Ao salvar uma nova revisão de FVS Padrão:
- A revisão anterior é arquivada (não deletada)
- Cada ambiente mantém a referência à revisão vigente quando a FVS foi associada
- Uma NC aberta criada com Rev. 2 continua referenciando Rev. 2 mesmo se Rev. 3 for publicada

### RN-05: Progresso automático
O progresso de cada nível é calculado automaticamente:
- **Ambiente:** `verificacoes_concluidas / fvs_planejadas * 100`
- **Obra:** média ponderada dos ambientes
- Uma FVS é "concluída" quando a última verificação tem status = 'conforme'

### RN-06: Foto de verificação
- Formatos aceitos: JPEG, PNG, HEIC
- Tamanho máximo: 10 MB por foto
- Máximo de 10 fotos por verificação
- Upload direto para R2 via presigned URL
- Thumbnail gerado automaticamente (400px)

### RN-07: Assinatura digital
- Canvas touch/mouse no mobile
- Armazenada como PNG no R2
- Metadados: inspetor, data/hora, dispositivo
- Imutável após salvar a verificação

### RN-08: Acesso por obra
- Um inspetor só vê obras para as quais foi explicitamente habilitado
- Habilitação feita pelo Administrador no painel web
- RLS do Supabase garante isolamento no banco

### RN-09: Offline obrigatório
- O app mobile deve funcionar completamente sem internet
- Todas as ações (criar verificação, tirar foto, assinar) funcionam offline
- Sync automático ao recuperar conexão
- Indicador visual de status de sync no app

### RN-10: FVS Padrão inativa
- FVS Padrão inativa não pode ser associada a novos ambientes
- Ambientes que já usam a FVS inativa continuam funcionando normalmente
- No painel, FVS inativas aparecem esmaecidas com aviso

---

## Módulos do Sistema

### Painel Web Administrativo (Next.js)
1. **Dashboard** — KPIs, progresso de obras, NC urgentes, atividade recente
2. **Empresas** — CRUD de empresas com CNPJ e dados de contato
3. **Obras** — CRUD de obras com engenheiro, ART, cronograma
4. **FVS Padrão** — Biblioteca de fichas com controle de revisões e status
5. **Ambientes** — Cadastro por obra com associação de FVS Padrão
6. **Equipes** — Funcionários próprios e terceirizados cadastrados
7. **Usuários** — Gestão de acesso por perfil e por obra
8. **Verificações** — Consulta de todas as verificações com visualização de fotos
9. **Não Conformidades** — Gestão centralizada com status e prazo
10. **Relatórios** — Exportação PDF/Excel por obra e período

### App Mobile (React Native + Expo)
1. **Login** — Autenticação com email/senha
2. **Dashboard** — Obras ativas, NC urgentes, atividade recente
3. **Obras** — Lista filtrada pelo acesso do inspetor logado
4. **Obra** — Detalhe com ambientes e progresso
5. **Ambiente** — Lista de FVS planejadas com status
6. **FVS Histórico** — Timeline de verificações do serviço
7. **Nova Verificação** — Formulário completo (checklist + fotos + NC + assinatura)
8. **NC Abertas** — Lista de não conformidades com prazo
9. **Perfil** — Dados do inspetor logado, logout

---

## Design de Referência

Os protótipos HTML completos estão na pasta `/references/`:
- `mobile-app.html` — Todas as telas do app mobile
- `admin-panel.html` — Painel administrativo completo (arquivo: `fvs_admin_prumoq.html`)

**Importante:** O design dos protótipos deve ser fielmente reproduzido na implementação. Ver `design-system.md` para todas as variáveis e tokens.

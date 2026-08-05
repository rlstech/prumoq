# Medições de serviços e impacto financeiro de NC

Os dois módulos são opcionais e iniciam desligados. A empresa define o padrão e a obra pode herdar, ativar ou desativar cada módulo individualmente. Com uma funcionalidade desligada, o fluxo atual de FVS e NC não exige dados novos.

## Saldo e medição

O saldo disponível é sempre calculado no banco: `aprovado acumulado - medido ativo - bloqueado por NC`. A verificação registra avanço executado e aprovado acumulado; a diferença vira uma liberação. Cada medição aloca uma quantidade decimal dessa liberação, permitindo pagar 300 de 450 aprovados e manter 150 disponíveis. Locks e constraints impedem que alocações concorrentes consumam a mesma quantidade. O cancelamento desativa as alocações e restaura o saldo.

Medições aprovadas são imutáveis. Use cancelamento com justificativa para corrigir uma medição. A troca de empreiteiro fecha o vínculo anterior, congela seus valores e abre outro somente com o escopo ainda não executado. Retrabalho é item financeiro separado e não altera avanço físico.

## Impacto financeiro da NC

Quando habilitado, toda NC deve declarar `sem impacto`, `em avaliação`, `estimado` ou `confirmado`, além de informar se bloqueia a medição. NC em avaliação ou apenas estimada não pode ser resolvida nem encerrada sem resolução. Histórico financeiro, bloqueio e auditoria são preservados sem exclusão física.

## Implantação

1. Aplicar `038` a `056`, estritamente em ordem, primeiro em clone ou banco de homologação.
2. Executar a suíte SQL contra banco descartável e regenerar `packages/shared/src/database.types.ts` usando o projeto alvo.
3. Atualizar as regras PowerSync antes de liberar o aplicativo com o schema novo. O schema local já conhece as novas tabelas; os buckets devem respeitar a mesma obra e o mesmo `cliente_id`.
4. Publicar web e mobile; os módulos permanecerão invisíveis até serem ativados manualmente.

Não aplique essas migrations diretamente em produção sem backup e validação. Após existirem dados financeiros, a reversão operacional segura é desabilitar as flags — não remover tabelas ou histórico.

## Como habilitar

No painel, abra **Empresas → Editar empresa → Recursos opcionais** para definir o padrão. Em seguida, abra a obra e use **Recursos opcionais da obra** para herdar o padrão ou ativar/desativar cada recurso especificamente. A página **Medições** exibe somente obras ativas para esse recurso. No detalhe da NC, o painel de impacto financeiro aparece somente se o controle financeiro estiver ativo na obra.

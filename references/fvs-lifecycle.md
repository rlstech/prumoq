# PrumoQ — Ciclo de vida e progresso da FVS

Este documento descreve a regra vigente. Os campos percentuais existentes no
banco são legados e não participam mais do fluxo nem do cálculo de progresso.

## Conceitos

- A verificação registra o resultado de uma inspeção em uma data.
- A FVS representa o acompanhamento do serviço e pode receber várias
  verificações.
- O resultado da verificação é derivado do checklist:
  - ao menos um item não conforme → `nao_conforme`;
  - todos os itens conforme ou não aplicável → `conforme`.
- Uma verificação conforme não conclui a FVS automaticamente.

## Estados da FVS

| Estado | Significado | Nova verificação |
|---|---|---|
| `pendente` | Nenhuma verificação registrada | Permitida |
| `em_andamento` | Acompanhamento iniciado | Permitida |
| `em_revisao` | FVS concluída que foi reaberta | Permitida |
| `concluida` | Conclusão explícita registrada | Bloqueada |
| `conforme` | Conclusão legada | Bloqueada |
| `concluida_ressalva` | Conclusão legada com ressalva | Bloqueada |

Não são criadas novas conclusões com ressalva. Os estados legados continuam
preservados, bloqueados e contabilizados como concluídos.

## Conclusão explícita

Na revisão de uma verificação normal, o usuário escolhe entre:

- **Salvar e continuar acompanhando**: salva somente a verificação e mantém a
  FVS aberta;
- **Salvar e concluir FVS**: salva a verificação, registra uma conclusão e
  bloqueia a FVS.

A conclusão só é permitida quando:

1. a verificação atual é normal, não uma reinspeção;
2. todos os itens foram respondidos;
3. o resultado derivado é `conforme`;
4. não existe NC em `aberta` ou `em_correcao`;
5. a FVS ainda não está concluída.

Toda conclusão nova referencia a verificação conforme que a originou por
`fvs_conclusoes.verificacao_id`.

## Reinspeção e reabertura

- A reinspeção pode resolver a última NC, mas nunca conclui a FVS.
- Depois de resolver as NCs, uma verificação normal posterior pode concluir a
  FVS.
- Uma FVS concluída só volta a aceitar verificações por meio do fluxo de
  reabertura com justificativa e autorização.
- A reabertura muda o estado para `em_revisao` e preserva todo o histórico.

## Progresso

O progresso é um indicador de cobertura das FVS planejadas:

```text
progresso = FVS concluídas / total de FVS planejadas × 100
```

- Ambiente: considera as FVS planejadas naquele ambiente.
- Obra: considera as FVS de todos os ambientes ativos da obra.
- Estados contabilizados como concluídos: `concluida`, `conforme` e
  `concluida_ressalva`.
- FVS reaberta (`em_revisao`) deixa de contar como concluída.
- NC aberta aparece como alerta separado e não substitui o estado da FVS.
- O progresso não altera automaticamente o status cadastral da obra.

## Histórico

Verificações, conclusões e reaberturas são eventos imutáveis para fins de
auditoria. A timeline deve apresentar todos em ordem cronológica.

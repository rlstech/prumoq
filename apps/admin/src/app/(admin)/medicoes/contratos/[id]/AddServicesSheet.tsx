import { useState, useTransition } from 'react';
import Modal from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';
import { hojeEmBrasilia } from '@/lib/dates';
import { addContractServices } from '../../actions';
import { money } from '../../format';
import type { Contract } from '../../types';
import ServicePicker, { draftPrice, draftQuantity, draftValid, type ServiceDrafts } from './ServicePicker';

/** Itens iniciais do contrato (antes da primeira medição aprovada). Depois disso, só por aditivo. */
export default function AddServicesSheet({ contract, onClose, onSaved }: { contract: Contract; onClose: () => void; onSaved: () => void }) {
  const { toast } = useToast();
  const [pending, startTransition] = useTransition();
  const [drafts, setDrafts] = useState<ServiceDrafts>({});
  const chosen = Object.entries(drafts);
  const total = chosen.reduce((sum, [, d]) => sum + (draftValid(d) ? draftQuantity(d) * (draftPrice(d) ?? 0) : 0), 0);

  function save() {
    if (chosen.some(([, d]) => !draftValid(d))) return toast('Informe unidade, quantidade maior que zero e preço válido em cada serviço marcado.', 'error');
    startTransition(async () => {
      const result = await addContractServices({
        contratoId: contract.id,
        obraId: contract.obra_id,
        dataInicio: contract.data_inicio > hojeEmBrasilia() ? contract.data_inicio : hojeEmBrasilia(),
        servicos: chosen.map(([fvsId, d]) => ({
          fvsId,
          metodo: d.metodo,
          unidade: d.metodo === 'unidade_concluida' ? 'un' : d.unidade.trim(),
          quantidade: draftQuantity(d),
          preco: draftPrice(d),
        })),
      });
      if (!result.success) {
        const first = 'error' in result && result.error ? result.error : result.failures[0]?.error;
        toast(result.added ? `${result.added} adicionados; ${result.failures.length} com erro: ${first}` : first ?? 'Falha ao adicionar.', 'error');
        if (result.added) onSaved();
        return;
      }
      toast(result.added === 1 ? 'Serviço adicionado ao contrato.' : `${result.added} serviços adicionados ao contrato.`, 'success');
      onSaved();
    });
  }

  return (
    <Modal
      isOpen
      onClose={onClose}
      title="Adicionar serviços"
      size="lg"
      footer={
        <>
          <span className="mr-auto text-sm text-txt-2">
            {chosen.length} {chosen.length === 1 ? 'serviço' : 'serviços'} · <b className="prumo-metric text-txt">{money(total)}</b>
          </span>
          <button type="button" onClick={onClose} className="prumo-secondary-button bg-bg-0 hover:bg-bg-2">Cancelar</button>
          <button type="button" onClick={save} disabled={pending || !chosen.length} className="prumo-primary-button disabled:opacity-50">
            {pending ? 'Salvando...' : 'Adicionar ao contrato'}
          </button>
        </>
      }
    >
      <p className="mb-4 text-sm text-txt-2">
        Marque as FVS da obra que este contrato cobre. Serviço com etapas ponderadas: adicione aqui e ajuste em "Configurar".
        Depois da primeira medição aprovada, mudanças nos itens passam a ser feitas por aditivo.
      </p>
      <ServicePicker obraId={contract.obra_id} drafts={drafts} onChange={setDrafts} />
    </Modal>
  );
}

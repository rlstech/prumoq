import { useMemo, useState, useTransition } from 'react';
import Modal from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';
import { hojeEmBrasilia } from '@/lib/dates';
import { saveContract } from './actions';
import type { Contract, Team, Work, WorkTeam } from './types';

interface ContractSheetProps {
  isOpen: boolean;
  onClose: () => void;
  /** Sem contrato = novo. */
  contract?: Contract | null;
  works: Work[];
  teams: Team[];
  workTeams: WorkTeam[];
  /** Sugestão de número para um contrato novo. */
  suggestedNumber?: string;
  onSaved: (id: string, created: boolean) => void;
}

const parseMoney = (value: string) => {
  const clean = value.replace(/[^\d,.-]/g, '').replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.');
  return clean ? Number(clean) : null;
};

export default function ContractSheet({ isOpen, onClose, contract, works, teams, workTeams, suggestedNumber, onSaved }: ContractSheetProps) {
  const { toast } = useToast();
  const [pending, startTransition] = useTransition();
  const editable = works.filter(w => w.controle_medicoes_efetivo || w.id === contract?.obra_id);
  const [obraId, setObraId] = useState(contract?.obra_id ?? editable[0]?.id ?? '');
  const [equipeId, setEquipeId] = useState(contract?.equipe_id ?? '');
  const [numero, setNumero] = useState(contract?.numero ?? suggestedNumber ?? '');
  const [objeto, setObjeto] = useState(contract?.objeto ?? '');
  const [valor, setValor] = useState(contract?.valor_contratado == null ? '' : String(contract.valor_contratado).replace('.', ','));
  const [inicio, setInicio] = useState(contract?.data_inicio ?? hojeEmBrasilia());
  const [fim, setFim] = useState(contract?.data_fim ?? '');
  const [obs, setObs] = useState(contract?.observacao ?? '');

  const workTeamsList = useMemo(
    () => teams.filter(t => workTeams.some(w => w.obra_id === obraId && w.equipe_id === t.id)),
    [teams, workTeams, obraId],
  );

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const valorNumber = parseMoney(valor);
    if (valor.trim() && (valorNumber == null || !Number.isFinite(valorNumber) || valorNumber < 0)) {
      toast('Valor contratado inválido.', 'error');
      return;
    }
    if (fim && fim < inicio) {
      toast('O término não pode ser antes do início.', 'error');
      return;
    }
    startTransition(async () => {
      const result = await saveContract({
        contratoId: contract?.id ?? null,
        obraId,
        equipeId,
        numero,
        objeto,
        valorContratado: valorNumber,
        dataInicio: inicio,
        dataFim: fim || null,
        observacao: obs.trim() || null,
      });
      if (!result.success) {
        toast(result.error, 'error');
        return;
      }
      toast(contract ? 'Contrato atualizado.' : 'Contrato criado. Agora adicione os serviços.', 'success');
      onSaved(result.id, !contract);
    });
  }

  const formId = 'contract-sheet-form';
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={contract ? `Editar ${contract.numero}` : 'Novo contrato'}
      size="md"
      footer={
        <>
          <button type="button" onClick={onClose} className="prumo-secondary-button bg-bg-0 hover:bg-bg-2">Cancelar</button>
          <button type="submit" form={formId} disabled={pending || !obraId || !equipeId || !numero.trim() || !objeto.trim()} className="prumo-primary-button disabled:opacity-50">
            {pending ? 'Salvando...' : contract ? 'Salvar contrato' : 'Criar e adicionar serviços'}
          </button>
        </>
      }
    >
      <form id={formId} onSubmit={submit} className="flex flex-col gap-4">
        {!contract ? <p className="text-sm text-txt-2">Depois de criar, adicione os serviços que entram no contrato.</p> : null}
        <label className="flex flex-col gap-2 text-[13px] font-semibold text-txt">
          Obra
          <select value={obraId} disabled={Boolean(contract)} onChange={e => { setObraId(e.target.value); setEquipeId(''); }} className="prumo-field py-2.5 disabled:opacity-60">
            {editable.map(w => <option key={w.id} value={w.id}>{w.nome}</option>)}
          </select>
          {!contract ? <span className="text-xs font-normal text-txt-2">Só aparecem obras com o controle de medições ligado.</span> : null}
        </label>
        <label className="flex flex-col gap-2 text-[13px] font-semibold text-txt">
          Empreiteiro
          <select value={equipeId} onChange={e => setEquipeId(e.target.value)} className="prumo-field py-2.5">
            <option value="">Selecione</option>
            {workTeamsList.map(t => <option key={t.id} value={t.id}>{t.nome}</option>)}
          </select>
          {obraId && !workTeamsList.length ? <span className="text-xs font-normal text-warn">Nenhuma equipe vinculada a esta obra. Vincule na página da obra.</span> : null}
        </label>
        <div className="grid gap-3 sm:grid-cols-[1fr_2fr]">
          <label className="flex min-w-0 flex-col gap-2 text-[13px] font-semibold text-txt">
            Nº do contrato
            <input value={numero} onChange={e => setNumero(e.target.value)} className="prumo-field py-2.5 font-mono" placeholder="CT-001" />
          </label>
          <label className="flex min-w-0 flex-col gap-2 text-[13px] font-semibold text-txt">
            Objeto
            <input value={objeto} onChange={e => setObjeto(e.target.value)} className="prumo-field py-2.5" placeholder="Ex.: Alvenaria e reboco" />
          </label>
        </div>
        <label className="flex flex-col gap-2 text-[13px] font-semibold text-txt">
          Valor contratado (R$)
          <input value={valor} onChange={e => setValor(e.target.value)} inputMode="decimal" className="prumo-field py-2.5 font-mono" placeholder="0,00" />
          <span className="text-xs font-normal text-txt-2">Se ficar vazio, vale a soma dos serviços (quantidade × preço).</span>
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="flex min-w-0 flex-col gap-2 text-[13px] font-semibold text-txt">
            Início
            <input type="date" value={inicio} onChange={e => setInicio(e.target.value)} className="prumo-field py-2.5 font-mono" />
          </label>
          <label className="flex min-w-0 flex-col gap-2 text-[13px] font-semibold text-txt">
            Término previsto
            <input type="date" value={fim} onChange={e => setFim(e.target.value)} className="prumo-field py-2.5 font-mono" />
          </label>
        </div>
        <label className="flex flex-col gap-2 text-[13px] font-semibold text-txt">
          Observação
          <textarea rows={3} value={obs} onChange={e => setObs(e.target.value)} className="prumo-field py-2.5" placeholder="Condições, retenção, forma de pagamento…" />
        </label>
      </form>
    </Modal>
  );
}

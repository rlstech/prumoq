
import { useState, useTransition } from 'react';
import { Settings2 } from '@/components/icons';
import { useRouter } from '@/lib/compat/navigation';
import { useToast } from '@/components/ui/Toast';
import { updateObraFeatureOverrides } from './actions';

type Override = boolean | null;

function toChoice(value: Override) {
  return value === null ? 'inherit' : value ? 'enabled' : 'disabled';
}

function fromChoice(value: string): Override {
  return value === 'inherit' ? null : value === 'enabled';
}

export default function ObraFeatureControls({
  obraId,
  medicionesOverride,
  financeiroOverride,
  medicionesEffective,
  financeiroEffective,
}: {
  obraId: string;
  medicionesOverride: Override;
  financeiroOverride: Override;
  medicionesEffective: boolean;
  financeiroEffective: boolean;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [medicoes, setMedicoes] = useState(toChoice(medicionesOverride));
  const [financeiro, setFinanceiro] = useState(toChoice(financeiroOverride));
  const [pending, startTransition] = useTransition();

  function save() {
    startTransition(async () => {
      const result = await updateObraFeatureOverrides(obraId, {
        controleMedicoesOverride: fromChoice(medicoes),
        controleFinanceiroNcOverride: fromChoice(financeiro),
      });
      if (!result.success) {
        toast(result.error ?? 'Não foi possível salvar os recursos.', 'error');
        return;
      }
      toast('Recursos opcionais atualizados.', 'success');
      router.refresh();
    });
  }

  return (
    <section className="prumo-panel p-5">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="flex items-center gap-2 text-[15px] font-bold text-txt"><Settings2 size={18} /> Recursos opcionais da obra</div>
          <p className="mt-1 text-[13px] leading-5 text-txt-2">Herdar usa o padrão da empresa. As regras do banco seguem esta configuração, não apenas a interface.</p>
        </div>
        <button type="button" onClick={save} disabled={pending} className="prumo-secondary-button bg-bg-0 hover:bg-bg-2">
          {pending ? 'Salvando...' : 'Salvar recursos'}
        </button>
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <FeatureSelect label="Controle de medições" value={medicoes} onChange={setMedicoes} effective={medicionesEffective} />
        <FeatureSelect label="Impacto financeiro de NC" value={financeiro} onChange={setFinanceiro} effective={financeiroEffective} />
      </div>
    </section>
  );
}

function FeatureSelect({ label, value, onChange, effective }: { label: string; value: string; onChange: (value: string) => void; effective: boolean }) {
  return (
    <label className="rounded-lg bg-bg-0 p-4 text-sm">
      <span className="block font-bold text-txt">{label}</span>
      <span className={`prumo-pill mt-1.5 ${effective ? 'bg-ok-bg text-ok' : 'bg-na-bg text-na'}`}>
        {effective ? 'Ativo nesta obra' : 'Desativado nesta obra'}
      </span>
      <select value={value} onChange={event => onChange(event.target.value)} className="prumo-field mt-3 block">
        <option value="inherit">Herdar da empresa</option>
        <option value="enabled">Ativar nesta obra</option>
        <option value="disabled">Desativar nesta obra</option>
      </select>
    </label>
  );
}

'use client';

import { useState, useTransition } from 'react';
import { Settings2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
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
    <section className="mb-6 rounded-xl border border-brd-0 bg-bg-1 p-4">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm font-semibold text-txt"><Settings2 size={16} /> Recursos opcionais da obra</div>
          <p className="mt-1 text-xs leading-5 text-txt-3">Herdar usa o padrão da empresa. As regras do banco seguem esta configuração, não apenas a interface.</p>
        </div>
        <button onClick={save} disabled={pending} className="rounded-lg bg-[var(--br)] px-3 py-2 text-xs font-medium text-white hover:bg-[var(--brd)] disabled:opacity-60">
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
    <label className="rounded-lg border border-brd-1 bg-bg-0 p-3 text-sm">
      <span className="block font-medium text-txt">{label}</span>
      <span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[11px] font-medium ${effective ? 'bg-ok-bg text-ok' : 'bg-na-bg text-na'}`}>
        {effective ? 'Ativo nesta obra' : 'Desativado nesta obra'}
      </span>
      <select value={value} onChange={event => onChange(event.target.value)} className="mt-3 block w-full rounded-md border border-brd-1 bg-bg-1 px-2.5 py-2 text-xs text-txt outline-none focus:border-[var(--br)]">
        <option value="inherit">Herdar da empresa</option>
        <option value="enabled">Ativar nesta obra</option>
        <option value="disabled">Desativar nesta obra</option>
      </select>
    </label>
  );
}

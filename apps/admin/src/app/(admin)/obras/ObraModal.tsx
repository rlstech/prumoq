
import { useEffect, useState } from 'react';
import Modal from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';
import { useRouter } from '@/lib/compat/navigation';
import { createObra, updateObra } from './actions';

interface ObraModalProps {
  isOpen: boolean;
  onClose: () => void;
  empresas: { id: string; nome: string }[];
  /** When provided, the modal is in edit mode */
  initialData?: {
    id: string;
    nome: string;
    empresa_id: string;
    status: string;
    municipio: string;
    uf: string;
    endereco: string;
    eng_responsavel: string;
    crea_cau: string;
    data_inicio_prev: string | null;
    data_termino_prev: string | null;
  };
}

const EMPTY_FORM = {
  nome: '',
  empresa_id: '',
  status: 'nao_iniciada',
  municipio: '',
  uf: '',
  endereco: '',
  eng_responsavel: '',
  crea_cau: '',
  data_inicio_prev: '',
  data_termino_prev: '',
};

export default function ObraModal({ isOpen, onClose, empresas, initialData }: ObraModalProps) {
  const { toast } = useToast();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const isEdit = !!initialData;

  const [formData, setFormData] = useState(EMPTY_FORM);

  // Sync form when initialData changes (edit mode)
  useEffect(() => {
    if (initialData) {
      setFormData({
        nome:               initialData.nome ?? '',
        empresa_id:         initialData.empresa_id ?? '',
        status:             initialData.status ?? 'nao_iniciada',
        municipio:          initialData.municipio ?? '',
        uf:                 initialData.uf ?? '',
        endereco:           initialData.endereco ?? '',
        eng_responsavel:    initialData.eng_responsavel ?? '',
        crea_cau:           initialData.crea_cau ?? '',
        data_inicio_prev:   initialData.data_inicio_prev ?? '',
        data_termino_prev:  initialData.data_termino_prev ?? '',
      });
    } else {
      setFormData(EMPTY_FORM);
    }
  }, [initialData, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.nome || !formData.empresa_id) {
      toast('Preencha os campos obrigatórios', 'error');
      return;
    }

    setLoading(true);

    const payload = {
      nome:             formData.nome,
      empresa_id:       formData.empresa_id,
      status:           formData.status,
      municipio:        formData.municipio,
      uf:               formData.uf.toUpperCase(),
      endereco:         formData.endereco,
      eng_responsavel:  formData.eng_responsavel,
      crea_cau:         formData.crea_cau,
      data_inicio_prev: formData.data_inicio_prev || null,
      data_termino_prev: formData.data_termino_prev || null,
    };

    const result = isEdit
      ? await updateObra(initialData!.id, payload)
      : await createObra(payload);

    setLoading(false);

    if (result.success) {
      toast(isEdit ? 'Obra atualizada com sucesso!' : 'Obra criada com sucesso!', 'success');
      router.refresh();
      onClose();
    } else {
      toast(result.error ?? 'Erro ao salvar obra', 'error');
    }
  };

  const f = formData;
  const set = (field: keyof typeof EMPTY_FORM) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setFormData(prev => ({ ...prev, [field]: e.target.value }));

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={isEdit ? 'Editar obra' : 'Nova obra'} size="lg">
      <form onSubmit={handleSubmit} className="flex flex-col gap-5">

        {/* Identificação */}
        <div className="bg-bg-0 rounded-lg p-4">
          <div className="text-xs font-semibold text-txt-2 mb-3">Identificação</div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="md:col-span-2">
              <label className="mb-2 block text-[13px] font-semibold text-txt">Nome da obra *</label>
              <input
                type="text"
                className="prumo-field py-2.5"
                value={f.nome} onChange={set('nome')}
                placeholder="Ex: Residencial Portal Oeste"
                required autoFocus
              />
            </div>
            <div>
              <label className="mb-2 block text-[13px] font-semibold text-txt">Empresa *</label>
              <select
                className="prumo-field py-2.5"
                value={f.empresa_id} onChange={set('empresa_id')} required
              >
                <option value="" disabled>Selecione a empresa</option>
                {empresas.map(emp => <option key={emp.id} value={emp.id}>{emp.nome}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-2 block text-[13px] font-semibold text-txt">Status</label>
              <select
                className="prumo-field py-2.5"
                value={f.status} onChange={set('status')}
              >
                <option value="nao_iniciada">Não iniciada</option>
                <option value="em_andamento">Em andamento</option>
                <option value="paralisada">Paralisada</option>
                <option value="concluida">Concluída</option>
              </select>
            </div>
          </div>
        </div>

        {/* Responsável Técnico */}
        <div className="bg-bg-0 rounded-lg p-4">
          <div className="text-xs font-semibold text-txt-2 mb-3">Responsável técnico</div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="mb-2 block text-[13px] font-semibold text-txt">Engenheiro responsável</label>
              <input
                type="text"
                className="prumo-field py-2.5"
                value={f.eng_responsavel} onChange={set('eng_responsavel')}
                placeholder="Ex: Eng. Roberto Matos"
              />
            </div>
            <div>
              <label className="mb-2 block text-[13px] font-semibold text-txt">CREA / CAU</label>
              <input
                type="text"
                className="prumo-field py-2.5"
                value={f.crea_cau} onChange={set('crea_cau')}
                placeholder="Ex: CREA-DF 12.345-D"
              />
            </div>
          </div>
        </div>

        {/* Localização */}
        <div className="bg-bg-0 rounded-lg p-4">
          <div className="text-xs font-semibold text-txt-2 mb-3">Localização</div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div className="md:col-span-2">
              <label className="mb-2 block text-[13px] font-semibold text-txt">Endereço</label>
              <input
                type="text"
                className="prumo-field py-2.5"
                value={f.endereco} onChange={set('endereco')}
                placeholder="Setor Hab. Jardins, Lote 24"
              />
            </div>
            <div>
              <label className="mb-2 block text-[13px] font-semibold text-txt">Município</label>
              <input
                type="text"
                className="prumo-field py-2.5"
                value={f.municipio} onChange={set('municipio')}
              />
            </div>
            <div>
              <label className="mb-2 block text-[13px] font-semibold text-txt">UF</label>
              <input
                type="text"
                maxLength={2}
                className="prumo-field py-2.5 uppercase"
                value={f.uf} onChange={e => setFormData(p => ({ ...p, uf: e.target.value.toUpperCase() }))}
              />
            </div>
          </div>
        </div>

        {/* Cronograma */}
        <div className="bg-bg-0 rounded-lg p-4">
          <div className="text-xs font-semibold text-txt-2 mb-3">Cronograma</div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="mb-2 block text-[13px] font-semibold text-txt">Previsão de início</label>
              <input
                type="date"
                className="prumo-field py-2.5"
                value={f.data_inicio_prev} onChange={set('data_inicio_prev')}
              />
            </div>
            <div>
              <label className="mb-2 block text-[13px] font-semibold text-txt">Previsão de conclusão</label>
              <input
                type="date"
                className="prumo-field py-2.5"
                value={f.data_termino_prev} onChange={set('data_termino_prev')}
              />
            </div>
          </div>
        </div>

        <div className="flex gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="prumo-secondary-button bg-bg-0 hover:bg-bg-2 flex-1"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={loading}
            className="prumo-primary-button flex-1 disabled:opacity-60"
          >
            {loading ? 'Salvando...' : isEdit ? 'Salvar alterações' : 'Criar obra'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

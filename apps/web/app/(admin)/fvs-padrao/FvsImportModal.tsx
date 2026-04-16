'use client';

import { useState } from 'react';
import { CheckCircle2, AlertTriangle, ChevronRight, ExternalLink } from 'lucide-react';
import Modal from '@/components/ui/Modal';
import { createClient } from '@/lib/supabase/client';
import { useToast } from '@/components/ui/Toast';
import { useRouter } from 'next/navigation';

interface ParsedItem {
  titulo: string;
  metodo_verif: string;
  tolerancia: string;
}

interface ParsedFvs {
  nome: string;
  codigo: string;
  categoria: string;
  itens: ParsedItem[];
}

interface ParseError {
  line: number;
  message: string;
}

const VALID_CATEGORIAS = ['estrutura', 'vedacao', 'revestimento', 'instalacoes', 'cobertura', 'acabamento', 'fundacao', 'terraplanagem', 'outro'];

function normalizeCategoria(raw: string): string {
  const normalized = raw.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
  return VALID_CATEGORIAS.includes(normalized) ? normalized : 'outro';
}

// Detecta se uma linha parece ser cabeçalho de planilha (não dado real).
// Nunca deve fazer match em valores de dados como "FVS 04.01".
function isHeaderLine(cols: string[]): boolean {
  if (cols.length < 2) return false;
  const first = cols[0].trim().toLowerCase();
  // Só considera header se o primeiro campo for uma palavra de rótulo pura,
  // sem números (ex: "código", "nome", "item") — exclui "FVS 04.01".
  return /^(código|codigo|nome|item|título|titulo|checklist|verific)$/.test(first);
}

// Classifica um critério como método de verificação ou tolerância.
// Padrões de medição (+/-, ±, números com unidade) → tolerância.
// Texto descritivo (ex: "Visual", "Inspeção visual") → método.
function classifyCriterion(value: string): 'metodo' | 'tolerancia' {
  if (/^[+\-±]|^\d|mm\b|cm\b|\bm\b|MPa\b|kN\b|%\b/i.test(value.trim())) return 'tolerancia';
  return 'metodo';
}

function parseTSV(text: string): { fvsList: ParsedFvs[]; errors: ParseError[] } {
  const lines = text.split('\n').map(l => l.trimEnd()).filter(l => l.trim() !== '');
  const errors: ParseError[] = [];
  const fvsMap = new Map<string, ParsedFvs>();

  const startIdx = lines.length > 0 && isHeaderLine(lines[0].split('\t')) ? 1 : 0;

  for (let i = startIdx; i < lines.length; i++) {
    const lineNum = i + 1;
    const cols = lines[i].split('\t');

    // Primeiras 3 colunas sempre fixas
    const codigo       = cols[0]?.trim() ?? '';
    const nome         = cols[1]?.trim() ?? '';
    const categoriaRaw = cols[2]?.trim() ?? '';
    // col[3] = Grupo/Subtítulo (sempre)
    const grupo        = cols[3]?.trim() ?? '';
    // col[4] = Descrição do item (pode ter critério embutido após 3+ espaços)
    const col4         = cols[4]?.trim() ?? '';
    // col[5] e col[6] = campos opcionais de método e tolerância separados
    const col5         = cols[5]?.trim() ?? '';
    const col6         = cols[6]?.trim() ?? '';

    if (!nome) {
      errors.push({ line: lineNum, message: 'Nome da FVS ausente — linha ignorada.' });
      continue;
    }
    if (!col4 && !grupo) {
      errors.push({ line: lineNum, message: `FVS "${nome}": título do item ausente — linha ignorada.` });
      continue;
    }

    let tituloBase: string;
    let metodo_verif: string;
    let tolerancia: string;

    if (col5 || col6) {
      // Colunas explícitas de método/tolerância presentes
      tituloBase = col4;
      if (col5 && col6) {
        // 7+ colunas com método e tolerância separados
        metodo_verif = col5;
        tolerancia   = col6;
      } else {
        // Uma das duas está preenchida: classificar automaticamente
        const criterion = col6 || col5;
        if (classifyCriterion(criterion) === 'tolerancia') {
          metodo_verif = '';
          tolerancia   = criterion;
        } else {
          metodo_verif = criterion;
          tolerancia   = '';
        }
      }
    } else {
      // Sem colunas explícitas: verificar se há critério embutido em col4
      // (separado por 3 ou mais espaços consecutivos)
      const embedded = col4.match(/^(.*?)\s{3,}(\S.+)$/);
      if (embedded) {
        tituloBase = embedded[1].trim();
        const criterion = embedded[2].trim();
        if (classifyCriterion(criterion) === 'tolerancia') {
          metodo_verif = '';
          tolerancia   = criterion;
        } else {
          metodo_verif = criterion;
          tolerancia   = '';
        }
      } else {
        tituloBase   = col4;
        metodo_verif = '';
        tolerancia   = '';
      }
    }

    const titulo = grupo ? `${grupo} — ${tituloBase}` : tituloBase;

    if (!titulo.trim()) {
      errors.push({ line: lineNum, message: `FVS "${nome}": título do item ausente — linha ignorada.` });
      continue;
    }

    const categoria = normalizeCategoria(categoriaRaw);
    const key = `${nome.toLowerCase()}|${categoria}`;

    if (!fvsMap.has(key)) {
      fvsMap.set(key, { nome, codigo, categoria, itens: [] });
    }
    fvsMap.get(key)!.itens.push({ titulo, metodo_verif, tolerancia });
  }

  return { fvsList: Array.from(fvsMap.values()), errors };
}

const CATEGORIA_LABELS: Record<string, string> = {
  estrutura: 'Estrutura',
  vedacao: 'Vedação',
  revestimento: 'Revestimento',
  instalacoes: 'Instalações',
  cobertura: 'Cobertura',
  acabamento: 'Acabamento',
  fundacao: 'Fundação',
  terraplanagem: 'Terraplanagem',
  outro: 'Outro',
};

interface FvsImportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function FvsImportModal({ isOpen, onClose }: FvsImportModalProps) {
  const { toast } = useToast();
  const router = useRouter();

  const [step, setStep] = useState<'paste' | 'preview' | 'done'>('paste');
  const [rawText, setRawText] = useState('');
  const [parsed, setParsed] = useState<ParsedFvs[]>([]);
  const [errors, setErrors] = useState<ParseError[]>([]);
  const [isImporting, setIsImporting] = useState(false);
  const [created, setCreated] = useState<{ id: string; nome: string }[]>([]);

  const handleClose = () => {
    setStep('paste');
    setRawText('');
    setParsed([]);
    setErrors([]);
    setCreated([]);
    onClose();
    if (step === 'done') router.refresh();
  };

  const handleAnalyze = () => {
    if (!rawText.trim()) {
      toast('Cole os dados antes de analisar.', 'error');
      return;
    }
    const { fvsList, errors: errs } = parseTSV(rawText);
    setParsed(fvsList);
    setErrors(errs);
    if (fvsList.length === 0) {
      toast('Nenhuma FVS válida encontrada. Verifique o formato.', 'error');
      return;
    }
    setStep('preview');
  };

  const handleImport = async () => {
    setIsImporting(true);
    const supabase = createClient();

    const { data: userData } = await supabase.from('usuarios' as any).select('empresa_id').single();
    const typedUser = userData as any;
    if (!typedUser?.empresa_id) {
      toast('Sua conta não tem empresa vinculada.', 'error');
      setIsImporting(false);
      return;
    }

    const { data: auth } = await supabase.auth.getSession();
    const userId = auth.session?.user?.id;

    const createdList: { id: string; nome: string }[] = [];

    for (const fvs of parsed) {
      // 1. Criar FVS Padrão
      const { data: novafvs, error: fvsError } = await (supabase.from('fvs_padrao') as any)
        .insert([{
          nome: fvs.nome,
          codigo: fvs.codigo || null,
          categoria: fvs.categoria,
          empresa_id: typedUser.empresa_id,
          revisao_atual: 0,
          ativo: true,
        }] as any)
        .select('id')
        .single();

      if (fvsError || !novafvs) {
        toast(`Erro ao criar "${fvs.nome}": ${fvsError?.message}`, 'error');
        continue;
      }

      const fvsId = (novafvs as any).id;

      // 2. Inserir itens
      const itens = fvs.itens.map((it, idx) => ({
        fvs_padrao_id: fvsId,
        revisao: 0,
        ordem: idx + 1,
        titulo: it.titulo,
        metodo_verif: it.metodo_verif || null,
        tolerancia: it.tolerancia || null,
      }));

      await supabase.from('fvs_padrao_itens' as any).insert(itens as any);

      // 3. Registrar revisão inicial
      await supabase.from('fvs_padrao_revisoes' as any).insert([{
        fvs_padrao_id: fvsId,
        numero_revisao: 0,
        revisado_por: userId ?? null,
        descricao_alt: 'Importação em lote',
      }] as any);

      createdList.push({ id: fvsId, nome: fvs.nome });
    }

    setCreated(createdList);
    setIsImporting(false);
    setStep('done');
  };

  const totalItens = parsed.reduce((acc, f) => acc + f.itens.length, 0);

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Importar FVS em Lote" size="lg">
      {step === 'paste' && (
        <div className="flex flex-col gap-4 p-1">
          <div className="bg-bg-2 border border-brd-0 rounded-lg p-4 text-xs text-txt-2 space-y-1.5">
            <p className="font-semibold text-txt">Formato esperado (TSV — cole direto do Excel ou Google Sheets):</p>
            <p>Cada linha = um item. Cole diretamente da sua planilha (Excel / Google Sheets).</p>
            <code className="block bg-bg-0 border border-brd-1 rounded px-3 py-2 font-mono text-[11px] text-txt-2 leading-relaxed">
              Código &nbsp;→&nbsp; Nome da FVS &nbsp;→&nbsp; Categoria &nbsp;→&nbsp; Grupo &nbsp;→&nbsp; Descrição do Item
            </code>
            <p className="text-txt-3 text-[11px]">O critério de aceitação ("Visual", "+/- 3mm") pode estar na mesma célula da descrição (separado por espaços) ou em uma coluna separada. Textos vão para <em>Método</em>, medições vão para <em>Tolerância</em>.</p>
            <p className="text-txt-3">Categorias válidas: estrutura, vedação, revestimento, instalações, cobertura, acabamento, fundação, terraplanagem, outro</p>
            <p className="text-txt-3">Linhas com o mesmo nome + categoria são agrupadas em uma única FVS.</p>
          </div>

          <div>
            <label className="block text-xs font-medium text-txt-2 mb-1.5">Cole os dados aqui *</label>
            <textarea
              className="w-full h-52 px-3 py-2 border border-brd-1 rounded bg-bg-0 text-[13px] font-mono outline-none focus:border-[var(--br)] resize-none"
              placeholder={"FVS 03.01\tExecução de Alvenaria\tvedacao\tPrumo das paredes\tNível de bolha\t±5 mm\nFVS 03.01\tExecução de Alvenaria\tvedacao\tEspessura de argamassa\tPaquímetro\t10-15 mm"}
              value={rawText}
              onChange={e => setRawText(e.target.value)}
            />
          </div>

          <div className="flex gap-3 justify-end pt-1 border-t border-brd-0">
            <button type="button" onClick={handleClose} className="px-5 py-2.5 bg-bg-2 rounded-lg text-sm font-medium hover:bg-brd-0 text-txt-2">
              Cancelar
            </button>
            <button type="button" onClick={handleAnalyze} className="flex items-center gap-2 px-5 py-2.5 bg-[var(--br)] text-white rounded-lg text-sm font-medium hover:bg-[var(--brd)]">
              Analisar <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}

      {step === 'preview' && (
        <div className="flex flex-col gap-4 p-1">
          <div className="flex items-center gap-3 bg-ok-bg border border-ok/20 rounded-lg px-4 py-3">
            <CheckCircle2 size={16} className="text-ok shrink-0" />
            <p className="text-sm text-ok font-medium">
              {parsed.length} FVS encontrada{parsed.length !== 1 ? 's' : ''} com {totalItens} item{totalItens !== 1 ? 'ns' : ''} no total.
            </p>
          </div>

          {errors.length > 0 && (
            <div className="bg-warn-bg border border-warn/20 rounded-lg p-3 space-y-1">
              <p className="text-xs font-semibold text-warn flex items-center gap-1.5"><AlertTriangle size={13} /> {errors.length} aviso{errors.length !== 1 ? 's' : ''}</p>
              {errors.map((e, i) => (
                <p key={i} className="text-xs text-warn/80 pl-4">Linha {e.line}: {e.message}</p>
              ))}
            </div>
          )}

          <div className="border border-brd-0 rounded-lg overflow-hidden max-h-72 overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="bg-bg-2 text-xs text-txt-2 uppercase tracking-wide">
                <tr>
                  <th className="text-left px-4 py-2.5 font-semibold w-24">Código</th>
                  <th className="text-left px-4 py-2.5 font-semibold">Nome da FVS</th>
                  <th className="text-left px-4 py-2.5 font-semibold">Categoria</th>
                  <th className="text-right px-4 py-2.5 font-semibold">Itens</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-brd-0">
                {parsed.map((fvs, i) => (
                  <tr key={i} className="bg-bg-1 hover:bg-bg-2">
                    <td className="px-4 py-2.5 font-mono text-xs text-txt-2">{fvs.codigo || '—'}</td>
                    <td className="px-4 py-2.5 font-medium text-txt">{fvs.nome}</td>
                    <td className="px-4 py-2.5 text-txt-2">{CATEGORIA_LABELS[fvs.categoria] ?? fvs.categoria}</td>
                    <td className="px-4 py-2.5 text-right text-txt-2">{fvs.itens.length}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex gap-3 justify-end pt-1 border-t border-brd-0">
            <button type="button" onClick={() => setStep('paste')} className="px-5 py-2.5 bg-bg-2 rounded-lg text-sm font-medium hover:bg-brd-0 text-txt-2">
              Voltar
            </button>
            <button type="button" onClick={handleImport} disabled={isImporting} className="flex items-center gap-2 px-5 py-2.5 bg-[var(--br)] text-white rounded-lg text-sm font-medium hover:bg-[var(--brd)] disabled:opacity-60">
              {isImporting ? 'Importando...' : `Importar ${parsed.length} FVS`}
            </button>
          </div>
        </div>
      )}

      {step === 'done' && (
        <div className="flex flex-col gap-4 p-1">
          <div className="flex items-center gap-3 bg-ok-bg border border-ok/20 rounded-lg px-4 py-3">
            <CheckCircle2 size={16} className="text-ok shrink-0" />
            <p className="text-sm text-ok font-medium">
              {created.length} FVS importada{created.length !== 1 ? 's' : ''} com sucesso!
            </p>
          </div>

          <div className="border border-brd-0 rounded-lg overflow-hidden max-h-64 overflow-y-auto">
            <ul className="divide-y divide-brd-0">
              {created.map((fvs) => (
                <li key={fvs.id} className="flex items-center justify-between px-4 py-2.5 bg-bg-1 hover:bg-bg-2">
                  <span className="text-sm text-txt font-medium">{fvs.nome}</span>
                  <a
                    href={`/fvs-padrao/${fvs.id}`}
                    className="flex items-center gap-1 text-xs text-[var(--br)] hover:underline"
                  >
                    Abrir <ExternalLink size={12} />
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <div className="flex justify-end pt-1 border-t border-brd-0">
            <button type="button" onClick={handleClose} className="px-5 py-2.5 bg-[var(--br)] text-white rounded-lg text-sm font-medium hover:bg-[var(--brd)]">
              Concluir
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}

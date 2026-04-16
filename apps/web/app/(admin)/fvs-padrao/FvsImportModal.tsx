'use client';

import { useState } from 'react';
import { CheckCircle2, AlertTriangle, ChevronRight, ExternalLink, ChevronDown, ChevronUp } from 'lucide-react';
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

function isHeaderLine(cols: string[]): boolean {
  if (cols.length < 2) return false;
  const first = cols[0].trim().toLowerCase();
  return /^(código|codigo|nome|item|título|titulo|checklist|verific)$/.test(first);
}

function parseTSV(text: string): { fvsList: ParsedFvs[]; errors: ParseError[] } {
  const lines = text.split('\n').map(l => l.trimEnd()).filter(l => l.trim() !== '');
  const errors: ParseError[] = [];
  const fvsMap = new Map<string, ParsedFvs>();

  const startIdx = lines.length > 0 && isHeaderLine(lines[0].split('\t')) ? 1 : 0;

  for (let i = startIdx; i < lines.length; i++) {
    const lineNum = i + 1;
    const cols = lines[i].split('\t');

    // Mapeamento direto 1:1 das 6 colunas
    const codigo       = cols[0]?.trim() ?? '';
    const nome         = cols[1]?.trim() ?? '';
    const categoriaRaw = cols[2]?.trim() ?? '';
    // col[3] → título do item (ex: "Condições de Início")
    const titulo       = cols[3]?.trim() ?? '';
    // col[4] → método de verificação (ex: "Verificar se o projeto de formas...")
    const metodo_verif = cols[4]?.trim() ?? '';
    // col[5] → tolerância (opcional: "Visual", "+/- 3mm", etc.)
    const tolerancia   = cols[5]?.trim() ?? '';

    if (!nome) {
      errors.push({ line: lineNum, message: 'Nome da FVS ausente — linha ignorada.' });
      continue;
    }
    if (!titulo) {
      errors.push({ line: lineNum, message: `FVS "${nome}": coluna "Descrição do Item" (col 4) vazia — linha ignorada.` });
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

  const [step, setStep] = useState<'paste' | 'preview' | 'review' | 'done'>('paste');
  const [rawText, setRawText] = useState('');
  const [parsed, setParsed] = useState<ParsedFvs[]>([]);
  const [errors, setErrors] = useState<ParseError[]>([]);
  const [isImporting, setIsImporting] = useState(false);
  const [created, setCreated] = useState<{ id: string; nome: string }[]>([]);
  const [expandedFvs, setExpandedFvs] = useState<Set<number>>(new Set([0]));

  const handleClose = () => {
    setStep('paste');
    setRawText('');
    setParsed([]);
    setErrors([]);
    setCreated([]);
    setExpandedFvs(new Set([0]));
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
    setExpandedFvs(new Set([0]));
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

      const itens = fvs.itens.map((it, idx) => ({
        fvs_padrao_id: fvsId,
        revisao: 0,
        ordem: idx + 1,
        titulo: it.titulo,
        metodo_verif: it.metodo_verif || null,
        tolerancia: it.tolerancia || null,
      }));

      await supabase.from('fvs_padrao_itens' as any).insert(itens as any);

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
  const totalWarnings = parsed.reduce(
    (acc, f) => acc + f.itens.filter(it => !it.metodo_verif && !it.tolerancia).length, 0
  );

  const toggleFvs = (idx: number) => {
    setExpandedFvs(prev => {
      const next = new Set(prev);
      next.has(idx) ? next.delete(idx) : next.add(idx);
      return next;
    });
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Importar FVS em Lote" size="xl">

      {/* ── ETAPA 1: COLAR DADOS ── */}
      {step === 'paste' && (
        <div className="flex flex-col gap-4 p-1">
          <div className="bg-bg-2 border border-brd-0 rounded-lg p-4 space-y-3 text-xs text-txt-2">
            <p className="font-semibold text-txt text-[13px]">Formato esperado — 6 colunas (cole direto do Excel ou Google Sheets)</p>

            <div className="overflow-x-auto">
              <table className="w-full text-[11px] border border-brd-1 rounded">
                <thead>
                  <tr className="bg-bg-0 text-txt-2 uppercase tracking-wide">
                    {['Código', 'Nome da FVS', 'Categoria', 'Descrição do Item', 'Método de verificação', 'Tolerância (opcional)'].map(h => (
                      <th key={h} className="px-2 py-1.5 text-left font-semibold border-b border-brd-1 whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr className="bg-bg-1">
                    <td className="px-2 py-1.5 font-mono border-b border-brd-0">FVS 04.01</td>
                    <td className="px-2 py-1.5 border-b border-brd-0">Montagem de Forma</td>
                    <td className="px-2 py-1.5 border-b border-brd-0">Estrutura</td>
                    <td className="px-2 py-1.5 border-b border-brd-0">Condições de Início</td>
                    <td className="px-2 py-1.5 border-b border-brd-0">Verificar o projeto de formas</td>
                    <td className="px-2 py-1.5 border-b border-brd-0 text-ok font-medium">Visual</td>
                  </tr>
                  <tr className="bg-bg-1">
                    <td className="px-2 py-1.5 font-mono">FVS 04.01</td>
                    <td className="px-2 py-1.5">Montagem de Forma</td>
                    <td className="px-2 py-1.5">Estrutura</td>
                    <td className="px-2 py-1.5">Locação</td>
                    <td className="px-2 py-1.5">Conferir locação dos gastalhos</td>
                    <td className="px-2 py-1.5 text-pg font-medium">+/- 3mm</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="space-y-1 text-[11px]">
              <p><span className="font-semibold text-txt">Descrição do Item</span> — título direto do item (ex: "Condições de Início", "Locação"). Salvo como título no banco.</p>
              <p><span className="font-semibold text-txt">Método de verificação</span> — como verificar o item (ex: "Verificar o projeto de formas e escoramento"). Salvo como método.</p>
              <p><span className="font-semibold text-txt">Tolerância (opcional)</span> — critério de aceitação (ex: "Visual", "+/- 3mm"). Salvo diretamente no campo tolerância.</p>
              <p><span className="font-semibold text-txt">Linhas com mesmo Nome + Categoria</span> são agrupadas em uma única FVS.</p>
            </div>

            <div className="flex items-start gap-2 bg-warn-bg border border-warn/25 rounded px-3 py-2 text-[11px] text-warn">
              <AlertTriangle size={13} className="shrink-0 mt-0.5" />
              <span><span className="font-semibold">Atenção:</span> não use células mescladas — cada linha precisa ter seu próprio valor em todas as colunas preenchidas. No Excel, selecione as células e use "Desfazer Mesclar Células" antes de copiar.</span>
            </div>

            <p className="text-[11px] text-txt-3">
              Categorias válidas: estrutura, vedação, revestimento, instalações, cobertura, acabamento, fundação, terraplanagem, outro
            </p>
          </div>

          <div>
            <label className="block text-xs font-medium text-txt-2 mb-1.5">Cole os dados aqui *</label>
            <textarea
              className="w-full h-52 px-3 py-2 border border-brd-1 rounded bg-bg-0 text-[13px] font-mono outline-none focus:border-[var(--br)] resize-none"
              placeholder={"FVS 04.01\tMontagem de Forma - Pilar e Cortina\tEstrutura\tCondições de Início\tVerificar o projeto de formas e escoramento\tVisual\nFVS 04.01\tMontagem de Forma - Pilar e Cortina\tEstrutura\tLocação\tConferir a locação dos gastalhos\t+/- 3mm"}
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

      {/* ── ETAPA 2: RESUMO DAS FVS ── */}
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
                <p key={i} className="text-xs text-warn/80 pl-4">{e.message}</p>
              ))}
            </div>
          )}

          <div className="border border-brd-0 rounded-lg overflow-hidden max-h-64 overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="bg-bg-2 text-xs text-txt-2 uppercase tracking-wide sticky top-0">
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
            <button type="button" onClick={() => setStep('review')} className="flex items-center gap-2 px-5 py-2.5 bg-[var(--br)] text-white rounded-lg text-sm font-medium hover:bg-[var(--brd)]">
              Revisar itens <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}

      {/* ── ETAPA 3: REVISÃO DETALHADA DOS ITENS ── */}
      {step === 'review' && (
        <div className="flex flex-col gap-4 p-1">
          <div className="flex items-start gap-3 bg-bg-2 border border-brd-0 rounded-lg px-4 py-3">
            <CheckCircle2 size={15} className="text-txt-2 shrink-0 mt-0.5" />
            <p className="text-xs text-txt-2">
              Verifique se os itens foram mapeados corretamente. Itens marcados com{' '}
              <span className="inline-flex items-center gap-0.5 text-warn font-medium"><AlertTriangle size={11} /> sem critério</span>{' '}
              estão sem método e tolerância — isso pode indicar células mescladas na planilha.
            </p>
          </div>

          {totalWarnings > 0 && (
            <div className="flex items-center gap-2 bg-warn-bg border border-warn/20 rounded-lg px-3 py-2 text-xs text-warn">
              <AlertTriangle size={13} className="shrink-0" />
              <span><span className="font-semibold">{totalWarnings} item{totalWarnings !== 1 ? 'ns' : ''}</span> sem método nem tolerância. Verifique se há células mescladas no Excel.</span>
            </div>
          )}

          <div className="border border-brd-0 rounded-lg overflow-hidden max-h-[420px] overflow-y-auto divide-y divide-brd-0">
            {parsed.map((fvs, fi) => {
              const isOpen = expandedFvs.has(fi);
              const fvsWarnings = fvs.itens.filter(it => !it.metodo_verif && !it.tolerancia).length;
              return (
                <div key={fi}>
                  {/* Header do accordion */}
                  <button
                    type="button"
                    onClick={() => toggleFvs(fi)}
                    className="w-full flex items-center gap-3 px-4 py-3 bg-bg-2 hover:bg-brd-0 transition-colors text-left"
                  >
                    {isOpen ? <ChevronUp size={14} className="text-txt-3 shrink-0" /> : <ChevronDown size={14} className="text-txt-3 shrink-0" />}
                    <span className="font-mono text-xs text-txt-2 w-20 shrink-0">{fvs.codigo || '—'}</span>
                    <span className="font-medium text-[13px] text-txt flex-1 truncate">{fvs.nome}</span>
                    <span className="text-xs text-txt-3 shrink-0">{CATEGORIA_LABELS[fvs.categoria]}</span>
                    <span className="text-xs text-txt-3 shrink-0 ml-3">{fvs.itens.length} itens</span>
                    {fvsWarnings > 0 && (
                      <span className="flex items-center gap-1 text-[11px] text-warn font-medium shrink-0 ml-2">
                        <AlertTriangle size={11} /> {fvsWarnings}
                      </span>
                    )}
                  </button>

                  {/* Itens expandidos */}
                  {isOpen && (
                    <table className="w-full text-xs">
                      <thead className="bg-bg-1 text-txt-3 uppercase tracking-wide border-b border-brd-0">
                        <tr>
                          <th className="text-right px-3 py-2 font-semibold w-8">Nº</th>
                          <th className="text-left px-3 py-2 font-semibold w-44">Título</th>
                          <th className="text-left px-3 py-2 font-semibold">Método</th>
                          <th className="text-left px-3 py-2 font-semibold w-28">Tolerância</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-brd-0">
                        {fvs.itens.map((item, ii) => {
                          const hasWarning = !item.metodo_verif && !item.tolerancia;
                          return (
                            <tr key={ii} className={`${hasWarning ? 'bg-warn-bg/40' : 'bg-bg-0'}`}>
                              <td className="px-3 py-2 text-right text-txt-3 tabular-nums">{ii + 1}</td>
                              <td className="px-3 py-2 text-txt leading-snug">
                                <span className="line-clamp-2">{item.titulo}</span>
                              </td>
                              <td className="px-3 py-2">
                                {item.metodo_verif
                                  ? <span className="text-ok font-medium">{item.metodo_verif}</span>
                                  : <span className="text-txt-3">—</span>
                                }
                              </td>
                              <td className="px-3 py-2">
                                <span className="flex items-center gap-1">
                                  {item.tolerancia
                                    ? <span className="text-pg font-medium">{item.tolerancia}</span>
                                    : <span className="text-txt-3">—</span>
                                  }
                                  {hasWarning && <AlertTriangle size={11} className="text-warn shrink-0" />}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}
                </div>
              );
            })}
          </div>

          <div className="flex gap-3 justify-end pt-1 border-t border-brd-0">
            <button type="button" onClick={() => setStep('preview')} className="px-5 py-2.5 bg-bg-2 rounded-lg text-sm font-medium hover:bg-brd-0 text-txt-2">
              Voltar
            </button>
            <button type="button" onClick={handleImport} disabled={isImporting} className="flex items-center gap-2 px-5 py-2.5 bg-[var(--br)] text-white rounded-lg text-sm font-medium hover:bg-[var(--brd)] disabled:opacity-60">
              {isImporting ? 'Importando...' : `Confirmar e Importar ${parsed.length} FVS`}
            </button>
          </div>
        </div>
      )}

      {/* ── ETAPA 4: CONCLUÍDO ── */}
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

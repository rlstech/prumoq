import * as FileSystem from 'expo-file-system';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';

export type ContractorEvaluationPdfReport = {
  id: string;
  status: string;
  obra: string;
  empreiteiro: string;
  cnpj: string | null;
  referencia: string | null;
  modelo: string;
  revisao: number;
  avaliador: string;
  dataAvaliacao: string;
  assinadaEm: string | null;
  assinaturaUri: string | null;
  pontosObtidos: number;
  pontosPossiveis: number;
  percentual: number;
  notificacoes: string | null;
  providencias: string | null;
  motivoInvalidacao: string | null;
  itens: Array<{ ordem: number; titulo: string; peso: number; resultado: string | null; comentario: string | null }>;
};

function escapeHtml(value: string | null | undefined): string {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function formatDate(value: string | null): string {
  if (!value) return '—';
  return new Date(value.length === 10 ? `${value}T12:00:00` : value).toLocaleString('pt-BR');
}

export function contractorEvaluationPdfFilename(report: ContractorEvaluationPdfReport): string {
  return `avaliacao-empreiteiro-${report.id}.pdf`;
}

export function renderContractorEvaluationPdfHtml(report: ContractorEvaluationPdfReport): string {
  const rows = report.itens.map(item => `
    <tr>
      <td class="num">${item.ordem}</td>
      <td>${escapeHtml(item.titulo)}${item.resultado === 'nao_atende' ? `<div class="comment">${escapeHtml(item.comentario)}</div>` : ''}</td>
      <td class="num">${item.peso}</td>
      <td class="num">${item.resultado === 'atende' ? 'X' : ''}</td>
      <td class="num">${item.resultado === 'nao_atende' ? 'X' : ''}</td>
    </tr>`).join('');
  // The platform adapter replaces this marker after converting the private/local
  // signature into a printable source.
  const signature = report.assinaturaUri ? '<img src="data-signature-placeholder" alt="Assinatura digital" />' : '';
  const invalidated = report.status === 'invalidada';

  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8" />
  <style>
    @page { size: A4 portrait; margin: 12mm; }
    * { box-sizing: border-box; }
    body { margin: 0; color: #142522; font-family: Arial, sans-serif; font-size: 11px; }
    .sheet { border: 1px solid #163B50; min-height: 270mm; }
    .head { display: grid; grid-template-columns: 130px 1fr 92px; border-bottom: 1px solid #163B50; }
    .brand { padding: 18px 12px; color: #163B50; font-size: 24px; font-weight: 700; }
    .title { border-left: 1px solid #163B50; border-right: 1px solid #163B50; padding: 18px 8px; text-align: center; font-size: 14px; font-weight: 700; }
    .issue { padding: 18px 8px; text-align: center; font-size: 9px; font-weight: 700; }
    .meta { display: grid; grid-template-columns: 1fr 1fr; border-bottom: 1px solid #163B50; }
    .meta div { min-height: 48px; padding: 7px 9px; border-right: 1px solid #D0D7D2; }
    .label, th { color: #52615B; font-size: 8px; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; }
    .label { display: block; margin-bottom: 3px; }
    table { width: 100%; border-collapse: collapse; }
    th, td { padding: 6px; border: 1px solid #7D8983; vertical-align: top; }
    th { background: #EDF0EB; }
    .num { text-align: center; }
    .comment { margin-top: 5px; padding-top: 5px; border-top: 1px solid #D9DDD9; color: #52615B; font-size: 10px; }
    .total { background: #F3F7D5; font-weight: 700; }
    .sections { padding: 9px; }
    .section { min-height: 56px; margin-top: 9px; border: 1px solid #7D8983; }
    .section h2 { margin: 0; padding: 5px 7px; border-bottom: 1px solid #7D8983; background: #EDF0EB; font-size: 9px; text-transform: uppercase; }
    .section p { min-height: 35px; margin: 0; padding: 7px; white-space: pre-wrap; }
    .sign { display: flex; justify-content: flex-end; padding: 28px 22px 14px; }
    .signbox { width: 220px; min-height: 78px; padding-top: 5px; border-top: 1px solid #142522; text-align: center; font-size: 9px; }
    .signbox img { display: block; max-width: 180px; max-height: 65px; margin: -68px auto 5px; }
    .invalid { position: fixed; top: 42%; left: 0; right: 0; color: #B23A3A; font-size: 34px; font-weight: 700; opacity: .16; text-align: center; transform: rotate(-22deg); }
  </style></head><body>
  ${invalidated ? '<div class="invalid">AVALIAÇÃO INVALIDADA</div>' : ''}
  <main class="sheet"><header class="head"><div class="brand">PrumoQ</div><div class="title">AVALIAÇÃO DE FORNECEDOR DE SERVIÇO<br /><small>${escapeHtml(report.modelo)} · Rev. ${report.revisao}</small></div><div class="issue">EMITIDO EM<br />${formatDate(report.dataAvaliacao)}</div></header>
  <section class="meta"><div><span class="label">Fornecedor / Empreiteiro</span>${escapeHtml(report.empreiteiro)}${report.cnpj ? ` · ${escapeHtml(report.cnpj)}` : ''}</div><div><span class="label">Obra</span>${escapeHtml(report.obra)}</div><div><span class="label">Origem</span>${report.referencia ? `Medição ${escapeHtml(report.referencia)}` : 'Avaliação avulsa'}</div><div><span class="label">Data da avaliação</span>${formatDate(report.dataAvaliacao)}</div></section>
  <table><thead><tr><th>Item</th><th>Critério de avaliação</th><th>Peso</th><th>Atende</th><th>Não atende</th></tr></thead><tbody>${rows}<tr class="total"><td colspan="2">TOTAL</td><td class="num">${report.pontosPossiveis}</td><td colspan="2">${report.pontosObtidos} pontos · ${report.percentual.toFixed(1)}%</td></tr></tbody></table>
  <div class="sections"><section class="section"><h2>Notificações ocorridas</h2><p>${escapeHtml(report.notificacoes) || 'Sem registros adicionais.'}</p></section><section class="section"><h2>Providências tomadas</h2><p>${escapeHtml(report.providencias) || 'Sem providências registradas.'}</p></section>${invalidated ? `<section class="section"><h2>Motivo da invalidação</h2><p>${escapeHtml(report.motivoInvalidacao)}</p></section>` : ''}</div>
  <div class="sign"><div class="signbox">${signature}<b>${escapeHtml(report.avaliador)}</b><br />Responsável pela avaliação · ${formatDate(report.assinadaEm)}</div></div>
  </main></body></html>`;
}

async function signatureAsDataUrl(uri: string | null): Promise<string | null> {
  if (!uri) return null;
  if (uri.startsWith('data:image/')) return uri;
  try {
    let localUri = uri;
    if (uri.startsWith('http://') || uri.startsWith('https://')) {
      const destination = `${FileSystem.cacheDirectory}pdf-signature-${Date.now()}.png`;
      localUri = (await FileSystem.downloadAsync(uri, destination)).uri;
    }
    if (!localUri.startsWith('file://')) return null;
    const base64 = await FileSystem.readAsStringAsync(localUri, { encoding: FileSystem.EncodingType.Base64 });
    return `data:image/png;base64,${base64}`;
  } catch { return null; }
}

export async function generateAndShareContractorEvaluationPdf(html: string, filename: string, signatureUri: string | null): Promise<void> {
  if (Platform.OS === 'web') {
    const popup = window.open('', '_blank');
    if (!popup) throw new Error('O navegador bloqueou a janela de impressão. Permita pop-ups e tente novamente.');
    popup.document.open();
    popup.document.write(signatureUri ? html.replace('data-signature-placeholder', signatureUri) : html.replace('src="data-signature-placeholder"', ''));
    popup.document.close();
    popup.focus();
    popup.setTimeout(() => popup.print(), 250);
    return;
  }
  const signature = await signatureAsDataUrl(signatureUri);
  const printableHtml = signature ? html.replace('data-signature-placeholder', signature) : html.replace('src="data-signature-placeholder"', '');
  const { uri } = await Print.printToFileAsync({ html: printableHtml, base64: false });
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf', dialogTitle: filename });
    return;
  }
  await Print.printAsync({ html: printableHtml });
}

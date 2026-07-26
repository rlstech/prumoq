export const FVS_MATRIX_VERIFICATIONS_PER_PAGE = 4;
export const FVS_MATRIX_ROWS_PER_PAGE = 14;
export const FVS_PHOTOS_PER_PAGE = 6;

export interface FvsReportRenderOptions {
  includeAttachments?: boolean;
}

export interface FvsPrintableHeader {
  obra_nome: string;
  empresa_nome: string | null;
  obra_municipio: string | null;
  obra_uf: string | null;
  obra_endereco: string | null;
  obra_eng_responsavel: string | null;
  obra_crea_cau: string | null;
  fvs_subservico: string;
  fvs_status: string;
  ambiente_nome: string;
  ambiente_tipo: string;
  ambiente_localizacao: string | null;
  fvs_revisao: string | null;
  fvs_concluida_em: string | null;
}

export interface FvsPrintableItem {
  id: string;
  fvs_padrao_item_id: string | null;
  ordem: number;
  titulo: string;
  metodo_verif: string | null;
  tolerancia: string | null;
  resultado: string;
}

export interface FvsPrintablePhoto {
  id: string;
  r2_url: string;
  ordem: number;
  kind?: 'verification' | 'nc' | 'reinspection';
  label?: string | null;
  availability?: FvsPhotoAvailability;
}

export type FvsPhotoAvailability = 'available' | 'pending' | 'expired';

export interface FvsResolvedPhotoSource {
  url: string;
  availability: FvsPhotoAvailability;
}

export interface FvsPrintableVerification {
  id: string;
  numero_verif: number;
  data_verif: string;
  status: string;
  observacoes: string | null;
  assinatura_url: string | null;
  percentual_exec: number;
  inspetor_nome: string | null;
  items: FvsPrintableItem[];
  fotos: FvsPrintablePhoto[];
}

export interface FvsPrintableNc {
  id: string;
  verificacao_id: string;
  descricao: string;
  solucao_proposta: string | null;
  data_nova_verif: string;
  status: string;
  item_titulo: string;
  responsavel_nome: string | null;
}

export interface FvsPrintableConclusion {
  numero_conclusao: number;
  percentual_final: number;
  resultado: string;
  observacao_final: string | null;
  assinatura_url?: string | null;
  inspetor_id?: string;
  created_at?: string;
}

export interface FvsPrintableReport {
  header: FvsPrintableHeader;
  verificacoes: FvsPrintableVerification[];
  ncs: FvsPrintableNc[];
  conclusao: FvsPrintableConclusion | null;
  emitidoEm: string;
}

export interface FvsMatrixRow {
  key: string;
  ordem: number;
  titulo: string;
  metodo_verif: string | null;
  tolerancia: string | null;
  resultados: Record<string, string | null>;
}

export interface FvsVerificationMatrix {
  rows: FvsMatrixRow[];
  verificationGroups: FvsPrintableVerification[][];
}

export function fvsPhotoPlaceholderDataUrl(
  availability: Exclude<FvsPhotoAvailability, 'available'>,
): string {
  const title =
    availability === 'pending'
      ? 'Foto aguardando sincronização'
      : 'Imagem não sincronizada';
  const detail =
    availability === 'pending'
      ? 'Conecte o dispositivo e tente novamente'
      : 'A referência local expirou e o arquivo não foi enviado';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="650"><rect width="100%" height="100%" fill="#F4F1E8"/><rect x="24" y="24" width="952" height="602" rx="18" fill="none" stroke="#C9D0CA" stroke-width="4" stroke-dasharray="14 10"/><text x="50%" y="47%" text-anchor="middle" font-family="Arial, sans-serif" font-size="36" font-weight="700" fill="#52615B">${title}</text><text x="50%" y="56%" text-anchor="middle" font-family="Arial, sans-serif" font-size="23" fill="#6E7A75">${detail}</text></svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

export function resolveFvsReportPhotoSource(
  source: string | null | undefined,
  r2Base: string,
): FvsResolvedPhotoSource | null {
  if (!source) return null;
  if (source.startsWith('data:') || source.startsWith('http')) {
    return { url: source, availability: 'available' };
  }
  if (source.startsWith('pending:')) {
    return {
      url: fvsPhotoPlaceholderDataUrl('pending'),
      availability: 'pending',
    };
  }
  if (source.startsWith('blob:')) {
    return {
      url: fvsPhotoPlaceholderDataUrl('expired'),
      availability: 'expired',
    };
  }

  return {
    url: `${r2Base.replace(/\/+$/, '')}/${source}`,
    availability: 'available',
  };
}

function normalizedItemKey(item: FvsPrintableItem): string {
  if (item.fvs_padrao_item_id) return `item:${item.fvs_padrao_item_id}`;
  return `legacy:${item.ordem}:${item.titulo.trim().toLocaleLowerCase('pt-BR')}`;
}

export function buildFvsVerificationMatrix(
  verifications: readonly FvsPrintableVerification[],
  verificationsPerPage = FVS_MATRIX_VERIFICATIONS_PER_PAGE,
): FvsVerificationMatrix {
  if (!Number.isInteger(verificationsPerPage) || verificationsPerPage < 1) {
    throw new Error('verificationsPerPage deve ser um inteiro maior que zero.');
  }

  const rowsByKey = new Map<string, FvsMatrixRow>();
  for (const verification of verifications) {
    for (const item of verification.items) {
      const key = normalizedItemKey(item);
      const existing = rowsByKey.get(key);
      const row = existing ?? {
        key,
        ordem: item.ordem,
        titulo: item.titulo,
        metodo_verif: item.metodo_verif,
        tolerancia: item.tolerancia,
        resultados: {},
      };

      // A FVS planejada mantém a revisão associada. Se houver um registro
      // legado divergente, os metadados mais recentes são os exibidos.
      row.ordem = item.ordem;
      row.titulo = item.titulo || row.titulo;
      row.metodo_verif = item.metodo_verif || row.metodo_verif;
      row.tolerancia = item.tolerancia || row.tolerancia;
      row.resultados[verification.id] = item.resultado;
      rowsByKey.set(key, row);
    }
  }

  const verificationGroups: FvsPrintableVerification[][] = [];
  for (let index = 0; index < verifications.length; index += verificationsPerPage) {
    verificationGroups.push(
      verifications.slice(index, index + verificationsPerPage),
    );
  }

  return {
    rows: Array.from(rowsByKey.values()).sort(
      (a, b) => a.ordem - b.ordem || a.titulo.localeCompare(b.titulo, 'pt-BR'),
    ),
    verificationGroups,
  };
}

const STATUS_LABELS: Record<string, string> = {
  pendente: 'Pendente',
  em_andamento: 'Em andamento',
  conforme: 'Conforme',
  nao_conforme: 'Não conforme',
  concluida: 'Concluída',
  concluida_ressalva: 'Concluída com ressalva',
  em_revisao: 'Em revisão',
};

function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function localDate(value: string | null): string {
  if (!value) return '—';
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
  }).format(new Date(value.length === 10 ? `${value}T12:00:00-03:00` : value));
}

function statusLabel(status: string): string {
  return STATUS_LABELS[status] || status;
}

function info(label: string, value: unknown): string {
  return `<div class="info"><b>${escapeHtml(label)}:</b> ${escapeHtml(value || '—')}</div>`;
}

function resultBadge(result: string | null | undefined): string {
  if (result === 'conforme') {
    return '<span class="result result-ok" aria-label="Conforme">C</span>';
  }
  if (result === 'nao_conforme') {
    return '<span class="result result-nok" aria-label="Não conforme">NC</span>';
  }
  if (result === 'na') {
    return '<span class="result result-na" aria-label="Não aplicável">N/A</span>';
  }
  return '<span class="result result-empty" aria-label="Não registrado">—</span>';
}

function reportIdentity(report: FvsPrintableReport, compact = false): string {
  const { header } = report;
  const environment = `${header.ambiente_nome} (${header.ambiente_tipo === 'interno' ? 'Interno' : 'Externo'}${header.ambiente_localizacao ? ` - ${header.ambiente_localizacao}` : ''})`;

  if (compact) {
    return `
      <div class="compact-identity">
        <strong>${escapeHtml(header.fvs_subservico)}</strong>
        <span>${escapeHtml(header.obra_nome)} · ${escapeHtml(environment)}${header.fvs_revisao ? ` · Rev. ${escapeHtml(header.fvs_revisao)}` : ''}</span>
      </div>`;
  }

  return `
    <div class="brand-row">
      <div><div class="brand">PrumoQ</div><small>Qualidade em Obras</small></div>
      <div class="document-title"><strong>Ficha de Verificação de Serviço</strong><small>Emitido em ${escapeHtml(report.emitidoEm)}</small></div>
    </div>
    <div class="brand-rule"></div>
    <div class="grid neutral">
      ${info('Obra', header.obra_nome)}
      ${info('Empresa', header.empresa_nome)}
      ${info('Município/UF', [header.obra_municipio, header.obra_uf].filter(Boolean).join('/'))}
      ${info('Endereço', header.obra_endereco)}
      ${info('Engenheiro responsável', header.obra_eng_responsavel)}
      ${info('CREA/CAU', header.obra_crea_cau)}
    </div>
    <div class="grid fvs">
      ${info('Serviço (FVS)', header.fvs_subservico)}
      ${info('Status', statusLabel(header.fvs_status))}
      ${info('Ambiente', environment)}
      ${info('Revisão', header.fvs_revisao ? `Rev. ${header.fvs_revisao}` : '—')}
      ${header.fvs_concluida_em ? info('Concluída em', localDate(header.fvs_concluida_em)) : ''}
    </div>`;
}

function matrixTable(
  report: FvsPrintableReport,
  rows: FvsMatrixRow[],
  group: FvsPrintableVerification[],
  groupIndex: number,
  rowPageIndex: number,
  totalRowPages: number,
  totalRows: number,
): string {
  const first = groupIndex * FVS_MATRIX_VERIFICATIONS_PER_PAGE + 1;
  const last = first + group.length - 1;
  const placeholderCount =
    FVS_MATRIX_VERIFICATIONS_PER_PAGE - group.length;
  const isFirstSheet = groupIndex === 0 && rowPageIndex === 0;
  const continuedHeader = isFirstSheet ? '' : reportIdentity(report, true);
  const rowFirst = rowPageIndex * FVS_MATRIX_ROWS_PER_PAGE + 1;
  const rowLast = rowFirst + rows.length - 1;
  const continuationLabel =
    totalRowPages > 1
      ? ` · Itens ${rowFirst}-${rowLast} de ${totalRows}`
      : '';

  const verificationHeaders = group
    .map(
      (verification) => `
        <th class="verification-column">
          <strong>V. ${verification.numero_verif}</strong>
          <span>${escapeHtml(localDate(verification.data_verif))}</span>
          <span>${escapeHtml(statusLabel(verification.status))}</span>
          <span>${verification.percentual_exec}%</span>
        </th>`,
    )
    .join('');
  const placeholderHeaders = Array.from(
    { length: placeholderCount },
    () => '<th class="verification-column verification-placeholder"></th>',
  ).join('');
  const placeholderCells = Array.from(
    { length: placeholderCount },
    () => '<td class="result-cell verification-placeholder"></td>',
  ).join('');

  const body = rows
    .map(
      (row) => `
        <tr>
          <td class="order">${row.ordem}</td>
          <td class="item-title">${escapeHtml(row.titulo)}</td>
          <td>${escapeHtml(row.metodo_verif || '—')}</td>
          <td>${escapeHtml(row.tolerancia || '—')}</td>
          ${group.map((verification) => `<td class="result-cell">${resultBadge(row.resultados[verification.id])}</td>`).join('')}
          ${placeholderCells}
        </tr>`,
    )
    .join('');

  return `
    <section class="matrix-sheet${isFirstSheet ? '' : ' matrix-continuation'}">
      ${continuedHeader}
      <div class="section-heading">
        <div><strong>Matriz de verificações</strong><span>Verificações ${first}-${last} de ${report.verificacoes.length}${continuationLabel}</span></div>
        <div class="legend"><span class="result result-ok">C</span> Conforme <span class="result result-nok">NC</span> Não conforme <span class="result result-na">N/A</span> Não aplicável</div>
      </div>
      <table class="matrix">
        <colgroup>
          <col class="col-order">
          <col class="col-item">
          <col class="col-method">
          <col class="col-tolerance">
          ${group.map(() => '<col class="col-verification">').join('')}
          ${Array.from({ length: placeholderCount }, () => '<col class="col-verification">').join('')}
        </colgroup>
        <thead>
          <tr>
            <th>#</th>
            <th>Item de verificação</th>
            <th>Método</th>
            <th>Tolerância</th>
            ${verificationHeaders}
            ${placeholderHeaders}
          </tr>
        </thead>
        <tbody>${body}</tbody>
      </table>
    </section>`;
}

function verificationDetails(
  verification: FvsPrintableVerification,
  ncs: FvsPrintableNc[],
): string {
  const ncRows = ncs
    .map(
      (nc) => `
        <tr>
          <td>${escapeHtml(nc.item_titulo)}</td>
          <td>${escapeHtml(nc.descricao)}</td>
          <td>${escapeHtml(nc.solucao_proposta || '—')}</td>
          <td>${escapeHtml(localDate(nc.data_nova_verif))}</td>
          <td>${escapeHtml(nc.responsavel_nome || '—')}</td>
          <td>${escapeHtml(statusLabel(nc.status))}</td>
        </tr>`,
    )
    .join('');

  return `
    <section class="verification-detail">
      <header>
        <strong>Verificação #${verification.numero_verif} - ${escapeHtml(localDate(verification.data_verif))}</strong>
        <span>${escapeHtml(verification.inspetor_nome || '—')} · ${escapeHtml(statusLabel(verification.status))} · ${verification.percentual_exec}%</span>
      </header>
      <div class="verification-detail-body">
        ${
          verification.observacoes
            ? `<p class="note"><strong>Observações:</strong> ${escapeHtml(verification.observacoes)}</p>`
            : '<p class="note muted-note">Sem observações registradas.</p>'
        }
        ${
          ncRows
            ? `<h3>Não conformidades (${ncs.length})</h3><table class="nc"><thead><tr><th>Item</th><th>Descrição</th><th>Solução</th><th>Prazo</th><th>Responsável</th><th>Status</th></tr></thead><tbody>${ncRows}</tbody></table>`
            : ''
        }
        ${
          verification.assinatura_url
            ? `<div class="signature"><strong>Assinatura digital</strong><img data-pdf-kind="signature" loading="eager" decoding="async" src="${escapeHtml(verification.assinatura_url)}" alt="Assinatura"><span>${escapeHtml(verification.inspetor_nome || '')}</span></div>`
            : ''
        }
      </div>
    </section>`;
}

function photoKindLabel(photo: FvsPrintablePhoto): string {
  if (photo.label) return photo.label;
  if (photo.kind === 'nc') return 'Evidência de não conformidade';
  if (photo.kind === 'reinspection') return 'Evidência de reinspeção';
  return 'Evidência da verificação';
}

function photoAvailabilityLabel(photo: FvsPrintablePhoto): string {
  if (photo.availability === 'pending') return 'Foto aguardando sincronização';
  if (photo.availability === 'expired') {
    return 'Imagem não sincronizada - referência local expirada';
  }
  return '';
}

function photoAnnexes(
  report: FvsPrintableReport,
  verification: FvsPrintableVerification,
): string {
  const pages: FvsPrintablePhoto[][] = [];
  for (
    let index = 0;
    index < verification.fotos.length;
    index += FVS_PHOTOS_PER_PAGE
  ) {
    pages.push(verification.fotos.slice(index, index + FVS_PHOTOS_PER_PAGE));
  }

  return pages
    .map((photos, pageIndex) => {
      const figures = photos
        .map(
          (photo, photoIndex) => {
            const availabilityLabel = photoAvailabilityLabel(photo);
            return `
            <figure${availabilityLabel ? ' class="photo-unavailable"' : ''}>
              <div class="photo-frame">
                <img data-pdf-kind="photo" loading="eager" decoding="async" src="${escapeHtml(photo.r2_url)}" alt="${escapeHtml(photoKindLabel(photo))}">
              </div>
              <figcaption>
                <div>
                  <strong>${escapeHtml(photoKindLabel(photo))}</strong>
                  ${availabilityLabel ? `<em>${escapeHtml(availabilityLabel)}</em>` : ''}
                </div>
                <span>Foto ${pageIndex * FVS_PHOTOS_PER_PAGE + photoIndex + 1} de ${verification.fotos.length}</span>
              </figcaption>
            </figure>`;
          },
        )
        .join('');

      return `
        <section class="photo-annex-page">
          ${reportIdentity(report, true)}
          <div class="section-heading attachment-heading">
            <div><strong>Anexos fotográficos</strong><span>Verificação #${verification.numero_verif} · ${escapeHtml(localDate(verification.data_verif))}</span></div>
            <span>Página ${pageIndex + 1} de ${pages.length}</span>
          </div>
          <div class="photos">${figures}</div>
        </section>`;
    })
    .join('');
}

export function renderFvsReportBody(
  report: FvsPrintableReport,
  options: FvsReportRenderOptions = {},
): string {
  const includeAttachments = options.includeAttachments ?? true;
  const matrix = buildFvsVerificationMatrix(report.verificacoes);
  const ncsByVerification = new Map<string, FvsPrintableNc[]>();
  for (const nc of report.ncs) {
    const rows = ncsByVerification.get(nc.verificacao_id) ?? [];
    rows.push(nc);
    ncsByVerification.set(nc.verificacao_id, rows);
  }

  const rowPages: FvsMatrixRow[][] = [];
  for (
    let index = 0;
    index < matrix.rows.length;
    index += FVS_MATRIX_ROWS_PER_PAGE
  ) {
    rowPages.push(matrix.rows.slice(index, index + FVS_MATRIX_ROWS_PER_PAGE));
  }
  if (!rowPages.length) rowPages.push([]);

  const matrixHtml = matrix.verificationGroups.length
    ? matrix.verificationGroups
        .flatMap((group, groupIndex) =>
          rowPages.map((rows, rowPageIndex) =>
            matrixTable(
              report,
              rows,
              group,
              groupIndex,
              rowPageIndex,
              rowPages.length,
              matrix.rows.length,
            ),
          ),
        )
        .join('')
    : '<p class="empty">Nenhuma verificação registrada para esta FVS no período selecionado.</p>';

  const details =
    report.verificacoes.length || report.conclusao
    ? `
      <section class="details">
        <div class="compact-identity">
          <strong>Registros complementares</strong>
          <span>${escapeHtml(report.header.fvs_subservico)} · ${report.verificacoes.length} registro(s)</span>
        </div>
        ${report.verificacoes
          .map((verification) =>
            verificationDetails(
              verification,
              ncsByVerification.get(verification.id) ?? [],
            ),
          )
          .join('')}
        ${
          report.conclusao
            ? `<section class="conclusion"><strong>Conclusão da FVS</strong><div class="grid">${info('Resultado', report.conclusao.resultado === 'aprovado' ? 'Aprovado' : 'Com ressalva')}${info('Percentual final', `${report.conclusao.percentual_final}%`)}${report.conclusao.observacao_final ? info('Observação', report.conclusao.observacao_final) : ''}</div></section>`
            : ''
        }
      </section>`
    : '';

  const photoPages = includeAttachments
    ? report.verificacoes
        .filter((verification) => verification.fotos.length > 0)
        .map((verification) => photoAnnexes(report, verification))
        .join('')
    : '';

  return `
    <article class="report">
      ${reportIdentity(report)}
      ${matrixHtml}
      ${details}
      ${photoPages}
    </article>`;
}

export const FVS_REPORT_CSS = `
  @page { size: A4 landscape; margin: 1.2cm; }
  * { box-sizing: border-box; }
  body { margin: 0; color: #142522; font-family: "IBM Plex Sans", Arial, Helvetica, sans-serif; font-size: 9px; }
  .report + .report { break-before: page; }
  .brand-row { display: flex; align-items: flex-start; justify-content: space-between; }
  .brand { color: #163B50; font-size: 22px; font-weight: 900; letter-spacing: -1px; }
  small { display: block; color: #6E7A75; margin-top: 2px; }
  .document-title { text-align: right; text-transform: uppercase; font-size: 12px; letter-spacing: .4px; }
  .document-title small { text-transform: none; font-size: 9px; font-weight: 400; }
  .brand-rule { border-top: 3px solid #D8E568; margin: 9px 0 10px; }
  .grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 4px 18px; }
  .neutral, .fvs { border-radius: 7px; padding: 7px 10px; margin-bottom: 8px; }
  .neutral { background: #F4F1E8; }
  .fvs { background: #F3F7D5; border-left: 3px solid #163B50; }
  .info b { color: #6E7A75; font-size: 7px; letter-spacing: .3px; text-transform: uppercase; }
  .compact-identity { border-bottom: 2px solid #D8E568; display: flex; justify-content: space-between; gap: 18px; margin-bottom: 8px; padding-bottom: 6px; }
  .compact-identity strong { color: #163B50; font-size: 13px; }
  .compact-identity span { color: #52615B; }
  .matrix-sheet { break-after: page; }
  .section-heading { align-items: end; display: flex; justify-content: space-between; gap: 16px; margin: 8px 0 5px; }
  .section-heading > div:first-child { display: flex; align-items: baseline; gap: 8px; }
  .section-heading strong { color: #163B50; font-size: 11px; text-transform: uppercase; }
  .section-heading span { color: #6E7A75; font-size: 8px; }
  .legend { align-items: center; color: #52615B; display: flex; gap: 4px; white-space: nowrap; }
  table { width: 100%; border-collapse: collapse; font-size: 7px; }
  thead { display: table-header-group; }
  .matrix tr { break-inside: avoid; }
  th { background: #E4E7E1; color: #52615B; font-size: 6.6px; letter-spacing: .2px; padding: 3px 4px; text-align: left; text-transform: uppercase; }
  td { border-top: 1px solid #E4E7E1; line-height: 1.25; padding: 3px 4px; vertical-align: top; overflow-wrap: anywhere; }
  tbody tr:nth-child(even) { background: #FAFAF8; }
  .matrix { table-layout: fixed; }
  .col-order { width: 8mm; }
  .col-item { width: 50mm; }
  .col-method { width: 80mm; }
  .col-tolerance { width: 30mm; }
  .order { color: #6E7A75; text-align: center; }
  .item-title { font-weight: 600; }
  .verification-column { background: #163B50; color: #fff; text-align: center; }
  .verification-column strong, .verification-column span { color: inherit; display: block; font-size: 7px; line-height: 1.35; }
  .verification-column strong { font-size: 8px; }
  .verification-placeholder { background: #F4F1E8; border-color: #E4E7E1; }
  .result-cell { text-align: center; vertical-align: middle; }
  .result { align-items: center; border: 1px solid transparent; border-radius: 3px; display: inline-flex; font-size: 7px; font-weight: 800; justify-content: center; min-height: 15px; min-width: 21px; padding: 1px 3px; }
  .result-ok { background: #E8F4EC; border-color: #B9D9C4; color: #2D7A4B; }
  .result-nok { background: #FAEAEA; border-color: #E9BDBD; color: #B23A3A; }
  .result-na { background: #EEF0EC; border-color: #D8DDD7; color: #52615B; }
  .result-empty { color: #9C9A93; }
  .details { break-before: page; break-after: page; }
  .verification-detail { border: 1px solid #D9DDD9; border-radius: 7px; break-inside: auto; box-decoration-break: clone; -webkit-box-decoration-break: clone; margin: 0 0 10px; overflow: visible; page-break-inside: auto; }
  .verification-detail > header { background: #163B50; color: #fff; display: flex; justify-content: space-between; gap: 12px; padding: 6px 10px; break-after: avoid-page; page-break-after: avoid; }
  .verification-detail-body { break-inside: auto; page-break-inside: auto; padding: 7px 10px 9px; }
  .note { background: #F4F1E8; border-left: 3px solid #6E7A75; border-radius: 4px; margin: 0 0 7px; padding: 5px 7px; }
  .muted-note { color: #6E7A75; }
  h3 { color: #52615B; font-size: 8px; letter-spacing: .4px; margin: 7px 0 4px; text-transform: uppercase; break-after: avoid; }
  .nc { break-inside: auto; margin-bottom: 7px; page-break-inside: auto; }
  .nc th { background: #FAEAEA; color: #B23A3A; }
  .nc tbody tr { break-inside: auto; page-break-inside: auto; }
  .photo-annex-page { break-after: page; }
  .attachment-heading { margin-bottom: 8px; }
  .photos { display: grid; gap: 7px; grid-template-columns: repeat(3, 1fr); }
  figure { border: 1px solid #D9DDD9; border-radius: 5px; break-inside: avoid; margin: 0; overflow: hidden; }
  .photo-frame { align-items: center; background: #F4F1E8; display: flex; height: 62mm; justify-content: center; padding: 4px; }
  figure img { display: block; height: 100%; max-width: 100%; object-fit: contain; width: 100%; }
  figcaption { align-items: center; background: #F4F1E8; color: #52615B; display: flex; font-size: 7px; justify-content: space-between; min-height: 8mm; padding: 4px 6px; }
  figcaption strong { color: #163B50; }
  figcaption div { display: flex; flex-direction: column; gap: 2px; }
  figcaption em { color: #B23A3A; font-size: 6.5px; font-style: normal; font-weight: 600; }
  .photo-unavailable { border-color: #E9BDBD; }
  .signature { border-top: 1px solid #E4E7E1; display: flex; align-items: end; gap: 10px; margin-top: 7px; padding-top: 6px; break-inside: avoid; }
  .signature img { background: white; border: 1px solid #D9DDD9; max-height: 50px; max-width: 160px; object-fit: contain; }
  .conclusion { background: #E8F4EC; border: 1px solid #B9D9C4; border-radius: 7px; color: #2D7A4B; margin-top: 10px; padding: 7px 10px; break-inside: avoid; }
  .conclusion .grid { color: #142522; margin-top: 5px; }
  .empty { color: #6E7A75; padding: 24px 0; text-align: center; }
  .report > :last-child { break-after: auto; }
  @media print {
    html, body, #root {
      display: block !important;
      flex: none !important;
      height: auto !important;
      min-height: 0 !important;
      overflow: visible !important;
      position: static !important;
    }
    #root > *, .report-preview, .report, .details {
      height: auto !important;
      max-height: none !important;
      min-height: 0 !important;
      overflow: visible !important;
    }
    .report-preview {
      box-shadow: none !important;
      max-width: none !important;
    }
  }
`;

export function renderFvsReportsHtml(
  reports: FvsPrintableReport[],
  options: FvsReportRenderOptions = {},
): string {
  return `<!doctype html>
  <html lang="pt-BR">
    <head>
      <meta charset="utf-8">
      <style>${FVS_REPORT_CSS}</style>
    </head>
    <body>${reports.map((report) => renderFvsReportBody(report, options)).join('')}</body>
  </html>`;
}

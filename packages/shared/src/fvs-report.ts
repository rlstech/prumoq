export const FVS_MATRIX_VERIFICATIONS_PER_PAGE = 8;
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
  inspetor_nome?: string | null;
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
  // Persisted media is an R2 object key. Protocol URLs are legacy/untrusted
  // references and must not become browser or server-side requests.
  if (source.startsWith('data:') || source.startsWith('http')) {
    return {
      url: fvsPhotoPlaceholderDataUrl('expired'),
      availability: 'expired',
    };
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
  // Status de não conformidade (enum status_nc).
  aberta: 'Aberta',
  em_correcao: 'Em correção',
  resolvida: 'Resolvida',
  cancelada: 'Cancelada',
};

const CLOSED_FVS_STATUS = new Set(['concluida', 'concluida_ressalva']);
const CLOSED_NC_STATUS = new Set(['resolvida', 'cancelada']);

const BRAND_MARK = `<svg class="mark" viewBox="0 0 32 34" aria-hidden="true"><path d="M16 2v9" fill="none" stroke="#163B50" stroke-width="2" stroke-linecap="round"/><circle cx="16" cy="18" r="10.5" fill="none" stroke="#163B50" stroke-width="2.6"/><path d="M16 11l5 6-5 6-5-6z" fill="#D8E568" stroke="#163B50" stroke-width="1.4" stroke-linejoin="round"/><path d="M20 24l5 7" fill="none" stroke="#163B50" stroke-width="2.6" stroke-linecap="round"/></svg>`;

function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function asDate(value: string): Date {
  return new Date(value.length === 10 ? `${value}T12:00:00-03:00` : value);
}

function localDate(value: string | null): string {
  if (!value) return '—';
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
  }).format(asDate(value));
}

// A matriz tem colunas estreitas: a data curta (dd/mm) é a que cabe no
// cabeçalho da coluna sem quebrar, como na FVS em papel.
function shortDate(value: string | null): string {
  if (!value) return '—';
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit',
    month: '2-digit',
  }).format(asDate(value));
}

// "Data de abertura da FVS" no formulário em papel: a primeira verificação
// registrada. As listas chegam da mais recente para a mais antiga.
function openingDate(report: FvsPrintableReport): string {
  const dates = report.verificacoes
    .map((verification) => verification.data_verif)
    .filter((value): value is string => Boolean(value))
    .sort();
  return dates.length ? localDate(dates[0]) : '—';
}

function statusLabel(status: string): string {
  return STATUS_LABELS[status] || status;
}

function identityField(
  label: string,
  value: unknown,
  mono = false,
): string {
  return `<div class="field"><b>${escapeHtml(label)}</b><span${mono ? ' class="mono"' : ''}>${escapeHtml(value || '—')}</span></div>`;
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

  const location = [header.obra_municipio, header.obra_uf]
    .filter(Boolean)
    .join('/');
  const revision = header.fvs_revisao
    ? `<span class="mono">Rev. ${escapeHtml(header.fvs_revisao)}</span>`
    : '';

  if (compact) {
    return `
      <div class="compact-identity">
        <div class="compact-brand">${BRAND_MARK}<div><strong>${escapeHtml(header.fvs_subservico)}</strong><span>${escapeHtml(header.obra_nome)} · ${escapeHtml(environment)}${revision ? ' · ' : ''}${revision}</span></div></div>
      </div>`;
  }

  const closed = CLOSED_FVS_STATUS.has(header.fvs_status);

  return `
    <header class="masthead">
      <div class="masthead-brand">
        ${BRAND_MARK}
        <div><strong>PrumoQ</strong><span>Sistema da Qualidade</span></div>
      </div>
      <div class="masthead-title">
        <strong>FVS — Ficha de Verificação de Serviço</strong>
        <span>${escapeHtml(header.fvs_subservico)}${revision ? ' · ' : ''}${revision}</span>
      </div>
      <div class="masthead-obra">
        <b>Obra</b>
        <strong>${escapeHtml(header.obra_nome)}</strong>
        <span>${escapeHtml([header.empresa_nome, location].filter(Boolean).join(' · ') || '—')}</span>
      </div>
    </header>
    <div class="identity">
      ${identityField('Local / ambiente da inspeção', environment)}
      ${identityField('Serviço verificado', header.fvs_subservico)}
      ${identityField('Eng. responsável', [header.obra_eng_responsavel, header.obra_crea_cau].filter(Boolean).join(' · '))}
      ${identityField('Abertura', openingDate(report), true)}
      ${identityField('Fechamento', localDate(header.fvs_concluida_em), true)}
      <div class="field${closed ? ' field-done' : ''}"><b>Situação</b><span>${escapeHtml(statusLabel(header.fvs_status))}</span></div>
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
  isLastSheet: boolean,
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
  const sheetClasses = ['matrix-sheet'];
  if (!isFirstSheet) sheetClasses.push('matrix-continuation');
  // Só a última folha da matriz pode fluir para o conteúdo seguinte na
  // mesma página — as demais precisam da quebra forçada para não misturar
  // colunas de verificações diferentes.
  if (isLastSheet) sheetClasses.push('matrix-sheet-flow');

  const verificationHeaders = group
    .map(
      (verification) => `
        <th class="verification-column">
          <strong>V${verification.numero_verif}</strong>
          <span class="mono">${escapeHtml(shortDate(verification.data_verif))}</span>
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
  const placeholderSignatureCells = Array.from(
    { length: placeholderCount },
    () => '<td class="verification-placeholder"></td>',
  ).join('');

  const body = rows
    .map(
      (row) => `
        <tr>
          <td class="order mono">${row.ordem}</td>
          <td class="item-title">${escapeHtml(row.titulo)}</td>
          <td class="meth">${escapeHtml(row.metodo_verif || '—')}</td>
          <td class="tol">${escapeHtml(row.tolerancia || '—')}</td>
          ${group.map((verification) => `<td class="result-cell">${resultBadge(row.resultados[verification.id])}</td>`).join('')}
          ${placeholderCells}
        </tr>`,
    )
    .join('');

  const signatureNames = group
    .map(
      (verification) =>
        `<td>${escapeHtml(verification.inspetor_nome || '—')}</td>`,
    )
    .join('');

  return `
    <section class="${sheetClasses.join(' ')}">
      ${continuedHeader}
      <div class="section-heading">
        <div><strong>Matriz de verificação</strong><span>Verificações ${first}-${last} de ${report.verificacoes.length}${continuationLabel}</span></div>
        <div class="legend">
          <span><i class="result result-ok">C</i>Conforme</span>
          <span><i class="result result-nok">NC</i>Não conforme</span>
          <span><i class="result result-na">N/A</i>Não aplicável</span>
          <span><i class="result result-empty">–</i>Não avaliado</span>
        </div>
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
            <th class="c">#</th>
            <th>Item de inspeção</th>
            <th>Método de verificação</th>
            <th>Tolerância</th>
            ${verificationHeaders}
            ${placeholderHeaders}
          </tr>
        </thead>
        <tbody>${body}</tbody>
        <tfoot>
          <tr>
            <td class="siglabel" colspan="4">Inspecionado por</td>
            ${signatureNames}
            ${placeholderSignatureCells}
          </tr>
        </tfoot>
      </table>
    </section>`;
}

function observationsStrip(
  verifications: readonly FvsPrintableVerification[],
): string {
  const withNotes = verifications.filter(
    (verification) =>
      verification.observacoes && verification.observacoes.trim().length > 0,
  );
  if (!withNotes.length) return '';

  const items = withNotes
    .map(
      (verification) =>
        `<b>V${verification.numero_verif}</b> ${escapeHtml(verification.observacoes)}`,
    )
    .join(' <span class="obs-sep">·</span> ');

  return `
    <div class="obs-strip">
      <div class="obs-strip-label">Observações</div>
      <div class="obs-strip-body">${items}</div>
    </div>`;
}

function ncsSection(
  ncs: readonly FvsPrintableNc[],
  verifications: readonly FvsPrintableVerification[],
): string {
  if (!ncs.length) return '';

  const verificationNumberById = new Map(
    verifications.map((verification) => [
      verification.id,
      verification.numero_verif,
    ]),
  );

  const rows = ncs
    .map(
      (nc, index) => `
        <tr>
          <td class="c">${index + 1}</td>
          <td class="c">V${verificationNumberById.get(nc.verificacao_id) ?? '—'}</td>
          <td>${escapeHtml(nc.item_titulo)}</td>
          <td>${escapeHtml(nc.descricao)}</td>
          <td>${escapeHtml(nc.solucao_proposta || '—')}</td>
          <td>${escapeHtml(nc.responsavel_nome || '—')}</td>
          <td class="c mono">${escapeHtml(localDate(nc.data_nova_verif))}</td>
          <td class="c"><span class="pill ${CLOSED_NC_STATUS.has(nc.status) ? 'pill-done' : 'pill-open'}">${escapeHtml(statusLabel(nc.status))}</span></td>
        </tr>`,
    )
    .join('');

  return `
    <section class="nc-section">
      <div class="section-heading nc-heading">
        <div><strong>Ocorrência de não conformidade e tratamento</strong><span>${ncs.length} ocorrência(s)</span></div>
      </div>
      <table class="nc">
        <colgroup>
          <col class="col-nc-num">
          <col class="col-nc-verif">
          <col class="col-nc-item">
          <col>
          <col>
          <col class="col-nc-resp">
          <col class="col-nc-date">
          <col class="col-nc-status">
        </colgroup>
        <thead>
          <tr>
            <th class="c">Nº</th>
            <th class="c">Verif.</th>
            <th>Item</th>
            <th>Descrição do problema</th>
            <th>Solução proposta (disposição)</th>
            <th>Responsável</th>
            <th class="c">Reinsp.</th>
            <th>Situação</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </section>`;
}

function conclusionSection(report: FvsPrintableReport): string {
  const { conclusao } = report;
  const totalAttachments = report.verificacoes.reduce(
    (total, verification) => total + verification.fotos.length,
    0,
  );

  const summary = `
    <div class="closing-field closing-field-wide">
      <b>Conclusão da FVS</b>
      <span>${
        conclusao
          ? escapeHtml(
              conclusao.resultado === 'aprovado'
                ? 'Aprovada'
                : 'Aprovada com ressalva',
            )
          : 'Em andamento'
      }</span>
    </div>
    <div class="closing-field">
      <b>Execução</b>
      <span>${conclusao ? `${Math.round(conclusao.percentual_final)}%` : '—'}</span>
    </div>
    <div class="closing-field">
      <b>Verificações</b>
      <span>${report.verificacoes.length}</span>
    </div>
    <div class="closing-field">
      <b>Anexos</b>
      <span>${totalAttachments ? `${totalAttachments} foto${totalAttachments === 1 ? '' : 's'}` : '—'}</span>
    </div>`;

  const signature = conclusao?.assinatura_url
    ? `
    <div class="closing-signature">
      <img data-pdf-kind="signature" loading="eager" decoding="async" src="${escapeHtml(conclusao.assinatura_url)}" alt="Assinatura de encerramento da FVS">
      <div>
        <b>Responsável pelo encerramento</b>
        <span>${escapeHtml(conclusao.inspetor_nome || '—')}</span>
      </div>
    </div>`
    : '';

  const observation = conclusao?.observacao_final
    ? `
    <div class="obs-strip">
      <div class="obs-strip-label">Observação de encerramento</div>
      <div class="obs-strip-body">${escapeHtml(conclusao.observacao_final)}</div>
    </div>`
    : '';

  return `
    <section class="closing">
      ${summary}
      ${signature}
      <div class="closing-meta">
        <span>Emitido em <i class="mono">${escapeHtml(report.emitidoEm)}</i></span>
        <span>PrumoQ · Sistema da Qualidade</span>
      </div>
    </section>
    ${observation}`;
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

interface FvsFlatPhoto {
  photo: FvsPrintablePhoto;
  verification: FvsPrintableVerification;
}

// Anexo fotográfico único e cronológico da FVS inteira, em vez de um bloco
// de páginas por verificação — só é chamada quando existe ao menos uma
// foto, então o PDF nunca ganha essa página à toa.
function photoAnnexes(report: FvsPrintableReport): string {
  const flatPhotos: FvsFlatPhoto[] = report.verificacoes.flatMap(
    (verification) =>
      verification.fotos.map((photo) => ({ photo, verification })),
  );
  if (!flatPhotos.length) return '';

  const pages: FvsFlatPhoto[][] = [];
  for (let index = 0; index < flatPhotos.length; index += FVS_PHOTOS_PER_PAGE) {
    pages.push(flatPhotos.slice(index, index + FVS_PHOTOS_PER_PAGE));
  }

  return pages
    .map((pagePhotos, pageIndex) => {
      const figures = pagePhotos
        .map(({ photo, verification }, photoIndex) => {
          const availabilityLabel = photoAvailabilityLabel(photo);
          return `
            <figure${availabilityLabel ? ' class="photo-unavailable"' : ''}>
              <div class="photo-frame">
                <img data-pdf-kind="photo" loading="eager" decoding="async" src="${escapeHtml(photo.r2_url)}" alt="${escapeHtml(photoKindLabel(photo))}">
              </div>
              <figcaption>
                <div>
                  <strong>${escapeHtml(photoKindLabel(photo))}</strong>
                  ${
                    availabilityLabel
                      ? `<em>${escapeHtml(availabilityLabel)}</em>`
                      : `<span class="fig-meta">V${verification.numero_verif} · ${escapeHtml(localDate(verification.data_verif))}</span>`
                  }
                </div>
                <span>Foto ${pageIndex * FVS_PHOTOS_PER_PAGE + photoIndex + 1} de ${flatPhotos.length}</span>
              </figcaption>
            </figure>`;
        })
        .join('');

      return `
        <section class="photo-annex-page">
          ${reportIdentity(report, true)}
          <div class="section-heading attachment-heading">
            <div><strong>Anexo fotográfico</strong><span>${flatPhotos.length} foto(s) registradas na FVS</span></div>
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

  const rowPages: FvsMatrixRow[][] = [];
  for (
    let index = 0;
    index < matrix.rows.length;
    index += FVS_MATRIX_ROWS_PER_PAGE
  ) {
    rowPages.push(matrix.rows.slice(index, index + FVS_MATRIX_ROWS_PER_PAGE));
  }
  if (!rowPages.length) rowPages.push([]);

  const sheets = matrix.verificationGroups.flatMap((group, groupIndex) =>
    rowPages.map((rows, rowPageIndex) => ({
      group,
      groupIndex,
      rows,
      rowPageIndex,
    })),
  );

  const matrixHtml = sheets.length
    ? sheets
        .map((sheet, sheetIndex) =>
          matrixTable(
            report,
            sheet.rows,
            sheet.group,
            sheet.groupIndex,
            sheet.rowPageIndex,
            rowPages.length,
            matrix.rows.length,
            sheetIndex === sheets.length - 1,
          ),
        )
        .join('')
    : '<p class="empty">Nenhuma verificação registrada para esta FVS no período selecionado.</p>';

  const observationsHtml = observationsStrip(report.verificacoes);
  const ncsHtml = ncsSection(report.ncs, report.verificacoes);
  const closingHtml = conclusionSection(report);
  const photoPages = includeAttachments ? photoAnnexes(report) : '';

  return `
    <article class="report">
      ${reportIdentity(report)}
      ${matrixHtml}
      ${observationsHtml}
      ${ncsHtml}
      ${closingHtml}
      ${photoPages}
    </article>`;
}

export const FVS_REPORT_CSS = `
  @page { size: A4 landscape; margin: 1.2cm; }
  * { box-sizing: border-box; }
  body { margin: 0; color: #142522; font-family: "IBM Plex Sans", Arial, Helvetica, sans-serif; font-size: 9px; }
  .mono { font-family: "IBM Plex Mono", "Courier New", monospace; }
  .report + .report { break-before: page; }
  .mark { display: block; flex: 0 0 auto; height: 28px; width: 26px; }
  .masthead { align-items: stretch; border: 1px solid #163B50; border-radius: 4px; display: flex; overflow: hidden; }
  .masthead-brand { align-items: center; border-right: 1px solid #C9D0CA; display: flex; gap: 9px; padding: 8px 14px; width: 232px; }
  .masthead-brand strong { color: #163B50; display: block; font-size: 17px; font-weight: 700; letter-spacing: -.02em; line-height: 19px; }
  .masthead-brand span { color: #6E7A75; display: block; font-size: 6.6px; font-weight: 600; letter-spacing: .16em; text-transform: uppercase; }
  .masthead-title { align-items: center; background: #F4F1E8; border-right: 1px solid #C9D0CA; display: flex; flex-direction: column; flex-grow: 1; justify-content: center; padding: 8px 16px; text-align: center; }
  .masthead-title strong { color: #142522; font-size: 13px; font-weight: 700; letter-spacing: -.01em; }
  .masthead-title span { color: #52615B; font-size: 7.6px; margin-top: 2px; }
  .masthead-obra { display: flex; flex-direction: column; gap: 2px; justify-content: center; padding: 7px 14px; width: 300px; }
  .masthead-obra b { color: #6E7A75; font-size: 6.4px; font-weight: 600; letter-spacing: .14em; text-transform: uppercase; }
  .masthead-obra strong { color: #142522; font-size: 11px; font-weight: 600; line-height: 13px; }
  .masthead-obra span { color: #52615B; font-size: 7.2px; }
  .identity { display: grid; gap: 6px; grid-template-columns: 1.5fr 1.15fr 1fr .72fr .72fr .8fr; margin-top: 8px; }
  .field { border: 1px solid #C9D0CA; border-radius: 3px; min-width: 0; padding: 4px 7px; }
  .field b { color: #6E7A75; display: block; font-size: 6.4px; font-weight: 600; letter-spacing: .1em; text-transform: uppercase; }
  .field span { display: block; font-size: 10px; font-weight: 600; line-height: 14px; margin-top: 2px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .field-done { background: #E8F4EC; border-color: #2D7A4B; }
  .field-done b, .field-done span { color: #2D7A4B; }
  .compact-identity { border-bottom: 2px solid #D8E568; margin-bottom: 8px; padding-bottom: 6px; }
  .compact-brand { align-items: center; display: flex; gap: 9px; }
  .compact-brand .mark { height: 22px; width: 21px; }
  .compact-identity strong { color: #163B50; display: block; font-size: 12px; line-height: 14px; }
  .compact-identity span { color: #52615B; display: block; font-size: 7.4px; }
  .matrix-sheet { break-after: page; page-break-after: always; }
  .matrix-sheet-flow { break-after: auto; page-break-after: auto; }
  .section-heading { align-items: end; display: flex; justify-content: space-between; gap: 16px; margin: 8px 0 5px; }
  .section-heading > div:first-child { display: flex; align-items: baseline; gap: 8px; }
  .section-heading strong { color: #163B50; font-size: 11px; text-transform: uppercase; }
  .section-heading span { color: #6E7A75; font-size: 8px; }
  .nc-heading strong { color: #B23A3A; }
  .legend { align-items: center; color: #52615B; display: flex; gap: 12px; white-space: nowrap; }
  .legend span { align-items: center; display: flex; font-size: 6.8px; gap: 4px; }
  table { width: 100%; border-collapse: collapse; font-size: 7px; }
  thead { display: table-header-group; }
  .matrix tr { break-inside: avoid; page-break-inside: avoid; }
  /* Grade fina em todas as células, como na FVS em papel. */
  th, td { border: 1px solid #C9D0CA; }
  th { background: #E4E7E1; color: #52615B; font-size: 6.6px; letter-spacing: .2px; padding: 3px 4px; text-align: left; text-transform: uppercase; }
  th.c { text-align: center; }
  td { line-height: 1.25; padding: 3px 4px; vertical-align: top; overflow-wrap: anywhere; }
  tbody tr:nth-child(even) td { background: #FAFAF8; }
  .matrix { table-layout: fixed; }
  .col-order { width: 8mm; }
  .col-item { width: 50mm; }
  .col-method { width: 55mm; }
  .col-tolerance { width: 25mm; }
  .matrix tbody td { vertical-align: middle; }
  .order { color: #6E7A75; text-align: center; }
  .item-title { font-weight: 600; }
  .matrix .meth, .matrix .tol { color: #52615B; }
  .verification-column { background: #163B50; color: #fff; text-align: center; }
  .verification-column strong, .verification-column span { color: inherit; display: block; font-size: 7px; line-height: 1.35; }
  .verification-column strong { font-size: 8px; }
  .verification-placeholder { background: #F4F1E8; border-color: #E4E7E1; }
  .result-cell { text-align: center; vertical-align: middle; }
  .result { align-items: center; border: 1.4px solid transparent; border-radius: 50%; display: inline-flex; font-size: 6.2px; font-style: normal; font-weight: 700; height: 15px; justify-content: center; line-height: 1; width: 15px; }
  .result-ok { background: #E8F4EC; border-color: #2D7A4B; color: #2D7A4B; font-size: 7px; }
  .result-nok { background: #FAEAEA; border-color: #B23A3A; border-radius: 3px; color: #B23A3A; }
  .result-na { background: #EEF0EC; border-color: #C9D0CA; color: #6E7A75; }
  .result-empty { color: #C9D0CA; font-size: 8px; font-weight: 400; }
  .matrix tfoot td { background: #F4F1E8; color: #52615B; font-size: 6.8px; padding: 4px 5px; text-align: center; vertical-align: middle; }
  .matrix tfoot td.siglabel { color: #163B50; font-size: 6.6px; font-weight: 600; letter-spacing: .09em; padding: 4px 6px; text-align: left; text-transform: uppercase; }
  .obs-strip { align-items: baseline; background: #FFFEFB; border: 1px solid #E4E7E1; border-left: 3px solid #D8E568; border-radius: 4px; break-inside: avoid; display: flex; gap: 10px; margin: 6px 0; padding: 5px 8px; }
  .obs-strip-label { color: #6E7A75; font-size: 6.6px; font-weight: 600; letter-spacing: .12em; text-transform: uppercase; white-space: nowrap; }
  .obs-strip-body { color: #142522; font-size: 7.4px; line-height: 10.5px; }
  .obs-strip-body b { color: #163B50; }
  .obs-sep { color: #C9D0CA; }
  .nc-section { break-inside: auto; margin: 6px 0; page-break-inside: auto; }
  .nc { break-inside: auto; margin-bottom: 7px; page-break-inside: auto; table-layout: fixed; }
  .nc th { background: #FAEAEA; color: #B23A3A; }
  .nc td.c { text-align: center; }
  .col-nc-num { width: 9mm; }
  .col-nc-verif { width: 12mm; }
  .col-nc-item { width: 38mm; }
  .col-nc-resp { width: 25mm; }
  .col-nc-date { width: 17mm; }
  .col-nc-status { width: 20mm; }
  .nc tbody tr { break-inside: auto; page-break-inside: auto; }
  .pill { border: 1px solid; border-radius: 2px; display: inline-block; font-size: 6.2px; font-weight: 600; letter-spacing: .04em; padding: 2px 4px; text-transform: uppercase; white-space: nowrap; }
  .pill-open { background: #FBF1DD; border-color: #E0C48B; color: #986014; }
  .pill-done { background: #E8F4EC; border-color: #B9D9C4; color: #2D7A4B; }
  .closing { align-items: stretch; break-inside: avoid; display: flex; gap: 6px; margin-top: 8px; }
  .closing-field { border: 1px solid #C9D0CA; border-radius: 3px; flex: 1 1 0; padding: 4px 8px; }
  .closing-field-wide { flex-grow: 2; }
  .closing-field b { color: #6E7A75; display: block; font-size: 6.4px; font-weight: 600; letter-spacing: .1em; text-transform: uppercase; }
  .closing-field span { display: block; font-size: 9px; font-weight: 600; line-height: 12px; margin-top: 2px; }
  .closing-signature { align-items: center; border: 1px solid #163B50; border-left: 3px solid #D8E568; border-radius: 3px; display: flex; flex: 0 0 auto; gap: 8px; padding: 4px 10px; }
  .closing-signature img { background: white; border: 1px solid #D9DDD9; max-height: 34px; max-width: 96px; object-fit: contain; }
  .closing-signature div { border-left: 1px solid #C9D0CA; padding-left: 8px; }
  .closing-signature b { color: #6E7A75; display: block; font-size: 6.4px; font-weight: 600; letter-spacing: .1em; text-transform: uppercase; }
  .closing-signature span { display: block; font-size: 9px; font-weight: 600; line-height: 12px; margin-top: 1px; }
  .closing-meta { display: flex; flex: 0 0 auto; flex-direction: column; justify-content: flex-end; padding-bottom: 2px; text-align: right; }
  .closing-meta span { color: #6E7A75; font-size: 6.6px; line-height: 9px; }
  .closing-meta i { font-style: normal; }
  .photo-annex-page { break-after: page; page-break-after: always; }
  .attachment-heading { margin-bottom: 8px; }
  .photos { display: grid; gap: 7px; grid-template-columns: repeat(3, 1fr); }
  figure { border: 1px solid #D9DDD9; border-radius: 5px; break-inside: avoid; margin: 0; overflow: hidden; }
  .photo-frame { align-items: center; background: #F4F1E8; display: flex; height: 62mm; justify-content: center; padding: 4px; }
  figure img { display: block; height: 100%; max-width: 100%; object-fit: contain; width: 100%; }
  figcaption { align-items: center; background: #F4F1E8; color: #52615B; display: flex; font-size: 7px; justify-content: space-between; min-height: 8mm; padding: 4px 6px; }
  figcaption strong { color: #163B50; }
  figcaption div { display: flex; flex-direction: column; gap: 2px; }
  figcaption em { color: #B23A3A; font-size: 6.5px; font-style: normal; font-weight: 600; }
  figcaption .fig-meta { color: #6E7A75; font-size: 6.5px; }
  .photo-unavailable { border-color: #E9BDBD; }
  .empty { color: #6E7A75; padding: 24px 0; text-align: center; }
  .report > :last-child { break-after: auto; page-break-after: auto; }
  @media print {
    html, body, #root {
      display: block !important;
      flex: none !important;
      height: auto !important;
      min-height: 0 !important;
      overflow: visible !important;
      position: static !important;
    }
    #root > *, .report-preview, .report {
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

import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildFvsVerificationMatrix,
  FVS_MATRIX_ROWS_PER_PAGE,
  renderFvsReportsHtml,
  resolveFvsReportPhotoSource,
} from '@prumoq/shared';
import type {
  FvsPrintableItem,
  FvsPrintableReport,
  FvsPrintableVerification,
} from '@prumoq/shared';

function item(
  verificationNumber: number,
  order: number,
  result: string,
): FvsPrintableItem {
  return {
    id: `verification-${verificationNumber}-item-${order}`,
    fvs_padrao_item_id: `standard-item-${order}`,
    ordem: order,
    titulo: `Item ${order}`,
    metodo_verif: `Método ${order}`,
    tolerancia: `${order} mm`,
    resultado: result,
  };
}

function verification(number: number): FvsPrintableVerification {
  return {
    id: `verification-${number}`,
    numero_verif: number,
    data_verif: `2026-07-${String(number).padStart(2, '0')}`,
    status: number % 2 === 0 ? 'nao_conforme' : 'conforme',
    observacoes: `Observação ${number}`,
    assinatura_url: `https://example.com/signature-${number}.png`,
    percentual_exec: number * 10,
    inspetor_nome: 'Inspetor',
    items: [
      item(number, 1, number % 2 === 0 ? 'nao_conforme' : 'conforme'),
      item(number, 2, 'na'),
    ],
    fotos: [],
  };
}

function report(verifications: FvsPrintableVerification[]): FvsPrintableReport {
  return {
    header: {
      obra_nome: 'Obra teste',
      empresa_nome: 'Empresa teste',
      obra_municipio: 'Brasília',
      obra_uf: 'DF',
      obra_endereco: 'Endereço',
      obra_eng_responsavel: 'Engenheira',
      obra_crea_cau: 'CREA 123',
      fvs_subservico: 'Serviço teste',
      fvs_status: 'em_andamento',
      ambiente_nome: 'Ambiente teste',
      ambiente_tipo: 'interno',
      ambiente_localizacao: 'Piso 1',
      fvs_revisao: '2',
      fvs_concluida_em: null,
    },
    verificacoes: verifications,
    ncs: [],
    conclusao: null,
    emitidoEm: '26/07/2026',
  };
}

test('agrupa todas as verificações em páginas horizontais de quatro colunas', () => {
  const verifications = Array.from({ length: 9 }, (_, index) =>
    verification(index + 1),
  );
  const matrix = buildFvsVerificationMatrix(verifications);

  assert.deepEqual(
    matrix.verificationGroups.map((group) => group.length),
    [4, 4, 1],
  );
  assert.equal(matrix.rows.length, 2);
  assert.equal(matrix.rows[0].resultados['verification-9'], 'conforme');
  assert.equal(matrix.rows[1].resultados['verification-9'], 'na');
});

test('mantém itens alinhados quando uma verificação não possui um resultado', () => {
  const first = verification(1);
  const second = verification(2);
  second.items = [second.items[0]];

  const matrix = buildFvsVerificationMatrix([first, second]);

  assert.equal(matrix.rows[1].resultados[first.id], 'na');
  assert.equal(matrix.rows[1].resultados[second.id], undefined);
});

test('renderiza todas as verificações, grupos e fotos sem cortes lógicos', () => {
  const verifications = Array.from({ length: 5 }, (_, index) =>
    verification(index + 1),
  );
  verifications[0].fotos = Array.from({ length: 8 }, (_, index) => ({
    id: `photo-${index + 1}`,
    r2_url: `https://example.com/photo-${index + 1}.jpg`,
    ordem: index,
  }));

  const html = renderFvsReportsHtml([report(verifications)]);

  for (const current of verifications) {
    assert.match(html, new RegExp(`V\\. ${current.numero_verif}`));
    assert.match(html, new RegExp(`Verificação #${current.numero_verif}`));
  }
  assert.match(html, /Verificações 1-4 de 5/);
  assert.match(html, /Verificações 5-5 de 5/);
  assert.equal(
    (html.match(/alt="Evidência da verificação"/g) ?? []).length,
    8,
  );
  assert.equal((html.match(/class="photo-annex-page"/g) ?? []).length, 2);
  assert.match(html, /object-fit: contain/);
  assert.match(html, /@page \{ size: A4 landscape/);
});

test('remove somente anexos fotográficos quando a opção é desativada', () => {
  const current = verification(1);
  current.fotos = [
    {
      id: 'photo-1',
      r2_url: 'https://example.com/photo-1.jpg',
      ordem: 0,
      kind: 'nc',
      label: 'Não conformidade: fissura',
    },
  ];
  const currentReport = report([current]);
  currentReport.ncs = [
    {
      id: 'nc-1',
      verificacao_id: current.id,
      descricao: 'Fissura',
      solucao_proposta: 'Reparar',
      data_nova_verif: '2026-07-30',
      status: 'aberta',
      item_titulo: 'Revestimento',
      responsavel_nome: 'Equipe A',
    },
  ];

  const html = renderFvsReportsHtml([currentReport], {
    includeAttachments: false,
  });

  assert.doesNotMatch(html, /<section class="photo-annex-page">/);
  assert.doesNotMatch(html, /photo-1\.jpg/);
  assert.match(html, /Fissura/);
  assert.match(html, /Assinatura digital/);
});

test('divide matrizes extensas em páginas explícitas sem perder itens', () => {
  const current = verification(1);
  current.items = Array.from(
    { length: FVS_MATRIX_ROWS_PER_PAGE + 3 },
    (_, index) => item(1, index + 1, 'conforme'),
  );

  const html = renderFvsReportsHtml([report([current])]);

  assert.equal((html.match(/class="matrix-sheet/g) ?? []).length, 2);
  assert.match(
    html,
    new RegExp(`Itens 1-${FVS_MATRIX_ROWS_PER_PAGE} de ${current.items.length}`),
  );
  assert.match(
    html,
    new RegExp(
      `Itens ${FVS_MATRIX_ROWS_PER_PAGE + 1}-${current.items.length} de ${current.items.length}`,
    ),
  );
  for (const currentItem of current.items) {
    assert.match(html, new RegExp(`>${currentItem.titulo}<`));
  }
});

test('permite que uma verificação extensa continue na página seguinte', () => {
  const current = verification(1);
  const currentReport = report([current]);
  currentReport.ncs = Array.from({ length: 30 }, (_, index) => ({
    id: `nc-${index + 1}`,
    verificacao_id: current.id,
    descricao: `Descrição extensa da não conformidade ${index + 1}`,
    solucao_proposta: `Solução proposta ${index + 1}`,
    data_nova_verif: '2026-08-01',
    status: 'aberta',
    item_titulo: `Item ${index + 1}`,
    responsavel_nome: 'Equipe A',
  }));

  const html = renderFvsReportsHtml([currentReport]);

  assert.match(
    html,
    /\.verification-detail \{[^}]*break-inside: auto;/,
  );
  assert.match(html, /\.nc tbody tr \{[^}]*break-inside: auto;/);
  assert.doesNotMatch(
    html,
    /\.verification-detail \{[^}]*break-inside: avoid;/,
  );
  assert.match(html, />Item 1</);
  assert.match(html, />Item 30</);
});

test('imprime 17 verificações em cinco matrizes mesmo sob o reset do Expo', () => {
  const verifications = Array.from({ length: 17 }, (_, index) => {
    const current = verification(index + 1);
    current.items = Array.from({ length: 4 }, (_, itemIndex) =>
      item(index + 1, itemIndex + 1, 'conforme'),
    );
    return current;
  });

  const html = renderFvsReportsHtml([report(verifications)]);

  assert.equal((html.match(/class="matrix-sheet/g) ?? []).length, 5);
  assert.match(html, /Verificações 1-4 de 17/);
  assert.match(html, /Verificações 9-12 de 17/);
  assert.match(html, /Verificações 17-17 de 17/);
  assert.equal((html.match(/>Item 4</g) ?? []).length, 5);
  assert.match(
    html,
    /html, body, #root \{[^}]*height: auto !important;[^}]*overflow: visible !important;/,
  );
  assert.match(
    html,
    /#root > \*, \.report-preview, \.report, \.details \{[^}]*overflow: visible !important;/,
  );
});

test('preserva anexos antigos como avisos em vez de omiti-los', () => {
  const available = resolveFvsReportPhotoSource(
    'fotos/usuario/evidencia.jpg',
    'https://fotos.example.com/',
  );
  const pending = resolveFvsReportPhotoSource(
    'pending:blob:http://localhost/foto',
    'https://fotos.example.com',
  );
  const expired = resolveFvsReportPhotoSource(
    'blob:http://localhost/foto',
    'https://fotos.example.com',
  );

  assert.deepEqual(available, {
    url: 'https://fotos.example.com/fotos/usuario/evidencia.jpg',
    availability: 'available',
  });
  assert.equal(pending?.availability, 'pending');
  assert.equal(expired?.availability, 'expired');
  assert.match(decodeURIComponent(pending?.url ?? ''), /aguardando sincronização/);
  assert.match(decodeURIComponent(expired?.url ?? ''), /Imagem não sincronizada/);

  const current = verification(1);
  current.fotos = [
    {
      id: 'pending-photo',
      r2_url: pending?.url ?? '',
      ordem: 0,
      availability: 'pending',
    },
    {
      id: 'expired-photo',
      r2_url: expired?.url ?? '',
      ordem: 1,
      availability: 'expired',
    },
  ];
  const html = renderFvsReportsHtml([report([current])]);

  assert.equal((html.match(/class="photo-unavailable"/g) ?? []).length, 2);
  assert.match(html, /Foto aguardando sincronização/);
  assert.match(html, /Imagem não sincronizada - referência local expirada/);
});

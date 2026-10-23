export type SpreadsheetValue = string | number | null | undefined;

export interface SpreadsheetColumn<Row> {
  header: string;
  value: (row: Row) => SpreadsheetValue;
}

function escapeXml(value: SpreadsheetValue): string {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

export function spreadsheetResponse<Row>(
  filename: string,
  sheetName: string,
  columns: SpreadsheetColumn<Row>[],
  rows: Row[],
): Response {
  const header = columns
    .map(
      (column) =>
        `<Cell ss:StyleID="Header"><Data ss:Type="String">${escapeXml(column.header)}</Data></Cell>`,
    )
    .join('');
  const body = rows
    .map(
      (row) =>
        `<Row>${columns
          .map((column) => {
            const value = column.value(row);
            const type = typeof value === 'number' ? 'Number' : 'String';
            return `<Cell><Data ss:Type="${type}">${escapeXml(value)}</Data></Cell>`;
          })
          .join('')}</Row>`,
    )
    .join('');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
 <Styles>
  <Style ss:ID="Default"><Alignment ss:Vertical="Center"/><Font ss:FontName="Arial" ss:Size="10"/></Style>
  <Style ss:ID="Header"><Font ss:Bold="1" ss:Color="#FFFFFF"/><Interior ss:Color="#163B50" ss:Pattern="Solid"/></Style>
 </Styles>
 <Worksheet ss:Name="${escapeXml(sheetName.slice(0, 31))}">
  <Table>
   <Row ss:Height="22">${header}</Row>
   ${body}
  </Table>
  <WorksheetOptions xmlns="urn:schemas-microsoft-com:office:excel"><FreezePanes/><FrozenNoSplit/><SplitHorizontal>1</SplitHorizontal><TopRowBottomPane>1</TopRowBottomPane></WorksheetOptions>
 </Worksheet>
</Workbook>`;

  return new Response(`\uFEFF${xml}`, {
    headers: {
      'Content-Type': 'application/vnd.ms-excel; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename.replaceAll('"', '')}"`,
      'Cache-Control': 'private, no-store',
    },
  });
}

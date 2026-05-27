import * as XLSX from 'xlsx';
import {
  comparePcaRows,
  createPcaExportWorkbook,
  createPcaReportTable,
  getPcaWorkbookSheetNames,
  isPcaComparableField,
  normalizeRangeAwareValue,
  parsePcaWorkbook,
} from './pcaExportLogic';

const headers = [
  '#',
  'Part Number',
  'Description',
  'Quantity',
  'Ref Des',
  'Approved Manufacturer 1',
  'Approved Manufacturer PN 1',
];

const makeWorkbookBuffer = (rows: Array<Array<string | number>>) => {
  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.aoa_to_sheet([
    ['', '', 'Synthetic product title'],
    headers,
    ...rows,
  ]);
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Bill of Materials');
  return XLSX.write(workbook, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer;
};

describe('parsePcaWorkbook', () => {
  it('reads PCA headers from row 2 and excludes the title row from data', () => {
    const buffer = makeWorkbookBuffer([
      ['0.0', 'ASM-001', 'Assembly', '', '', '', ''],
      ['1.1', 'PART-001', 'Part one', 2, 'R1 R2', 'Maker', 'MPN-1'],
    ]);

    const parsed = parsePcaWorkbook(buffer);

    expect(parsed.sheetName).toBe('Bill of Materials');
    expect(parsed.headers).toEqual(headers);
    expect(parsed.rows).toHaveLength(2);
    expect(parsed.rows[0]['#']).toBe('0.0');
    expect(parsed.rows[0]).not.toHaveProperty('Synthetic product title');
  });

  it('lists sheets and parses the selected worksheet', () => {
    const workbook = XLSX.utils.book_new();
    const firstWorksheet = XLSX.utils.aoa_to_sheet([
      ['', '', 'First title'],
      headers,
      ['1.1', 'FIRST', 'First item', 1, 'R1', '', ''],
    ]);
    const secondWorksheet = XLSX.utils.aoa_to_sheet([
      ['', '', 'Second title'],
      headers,
      ['1.1', 'SECOND', 'Second item', 1, 'R2', '', ''],
    ]);
    XLSX.utils.book_append_sheet(workbook, firstWorksheet, 'Bill of Materials');
    XLSX.utils.book_append_sheet(workbook, secondWorksheet, 'Alternate BOM');
    const buffer = XLSX.write(workbook, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer;

    expect(getPcaWorkbookSheetNames(buffer)).toEqual(['Bill of Materials', 'Alternate BOM']);

    const parsed = parsePcaWorkbook(buffer, 'Alternate BOM');

    expect(parsed.sheetName).toBe('Alternate BOM');
    expect(parsed.rows[0]['Part Number']).toBe('SECOND');
  });
});

describe('comparePcaRows', () => {
  const leftRows = [
    { '#': '1.1', 'Part Number': 'P1', Description: 'Same', Quantity: '1', 'Ref Des': 'R1 R2' },
    { '#': '1.2', 'Part Number': 'P2', Description: 'Same', Quantity: '3', 'Ref Des': 'R3-R5' },
  ];

  const rightRows = [
    { '#': '9.1', 'Part Number': 'P1', Description: 'Same', Quantity: '1', 'Ref Des': 'R1 R2' },
    { '#': '9.2', 'Part Number': 'P2', Description: 'Same', Quantity: '4', 'Ref Des': 'R3 R4 R5' },
    { '#': '9.3', 'Part Number': 'P3', Description: 'Added', Quantity: '1', 'Ref Des': 'C1' },
  ];

  it('compares only selected fields and ignores unselected # changes', () => {
    const result = comparePcaRows({
      leftRows,
      rightRows,
      keyField: 'Part Number',
      selectedFields: ['Description'],
    });

    expect(result.rows).toEqual([
      expect.objectContaining({ key: 'P3', status: 'added' }),
    ]);
  });

  it('includes changed and right-only rows for selected fields', () => {
    const result = comparePcaRows({
      leftRows,
      rightRows,
      keyField: 'Part Number',
      selectedFields: ['Quantity'],
    });

    expect(result.rows.map(row => row.key)).toEqual(['P2', 'P3']);
    expect(result.rows[0].values.Quantity.changed).toBe(true);
  });

  it('does not compare the key field or PCA line-number column', () => {
    const result = comparePcaRows({
      leftRows: [{ '#': '1.1', 'Part Number': 'P1', Quantity: '1' }],
      rightRows: [{ '#': '2.1', 'Part Number': 'P1', Quantity: '1' }],
      keyField: 'Part Number',
      selectedFields: ['#', 'Part Number', 'Quantity'],
    });

    expect(result.selectedFields).toEqual(['Quantity']);
    expect(result.rows).toHaveLength(0);
  });

  it('keeps right-only rows in positional pass order like the existing merge flow', () => {
    const result = comparePcaRows({
      leftRows: [
        { 'Part Number': 'P1', Quantity: '1' },
        { 'Part Number': 'P2', Quantity: '1' },
        { 'Part Number': 'P4', Quantity: '1' },
      ],
      rightRows: [
        { 'Part Number': 'P1', Quantity: '1' },
        { 'Part Number': 'P3', Quantity: '1' },
        { 'Part Number': 'P2', Quantity: '1' },
        { 'Part Number': 'P4', Quantity: '2' },
      ],
      keyField: 'Part Number',
      selectedFields: ['Quantity'],
    });

    expect(result.rows.map(row => row.key)).toEqual(['P3', 'P4']);
  });
});

describe('isPcaComparableField', () => {
  it('excludes the key field and PCA row-number column', () => {
    expect(isPcaComparableField('#', 'Part Number')).toBe(false);
    expect(isPcaComparableField('Part Number', 'Part Number')).toBe(false);
    expect(isPcaComparableField('Ref Des', 'Part Number')).toBe(true);
  });
});

describe('normalizeRangeAwareValue', () => {
  it('normalizes prefixed and numeric ranges while leaving mixed prefixes literal', () => {
    expect(normalizeRangeAwareValue('R1-R3')).toBe('R1 R2 R3');
    expect(normalizeRangeAwareValue('1-3')).toBe('1 2 3');
    expect(normalizeRangeAwareValue('R1-C3')).toBe('R1-C3');
    expect(normalizeRangeAwareValue('R1 R2 R3')).toBe('R1 R2 R3');
  });

  it('makes range values comparable to explicit token lists', () => {
    expect(normalizeRangeAwareValue('R3-R5')).toBe(normalizeRangeAwareValue('R3 R4 R5'));
  });
});

describe('createPcaReportTable', () => {
  it('creates a wide table with only rows and field groups that have differences', () => {
    const comparison = comparePcaRows({
      leftRows: [
        {
          'Part Number': 'P1',
          Description: 'Same',
          Quantity: '1',
          'Ref Des': 'R1 R2',
        },
        {
          'Part Number': 'P2',
          Description: 'Same',
          Quantity: '3',
          'Ref Des': 'R3-R5',
        },
      ],
      rightRows: [
        {
          'Part Number': 'P1',
          Description: 'Same',
          Quantity: '1',
          'Ref Des': 'R1 R2',
        },
        {
          'Part Number': 'P2',
          Description: 'Same',
          Quantity: '4',
          'Ref Des': 'R3 R4 R5',
        },
      ],
      keyField: 'Part Number',
      selectedFields: ['Part Number', 'Description', 'Quantity', 'Ref Des'],
    });

    const report = createPcaReportTable(comparison);

    expect(report.rows).toHaveLength(1);
    expect(report.columns.map(column => column.header)).toEqual([
      'Part Number',
      'Description Old',
      'Description New',
      'Qty Old',
      'Qty New',
      'Qty Diff',
    ]);
    expect(report.rows[0]).toEqual({
      key: 'P2',
      field_0_old: 'Same',
      field_0_new: 'Same',
      field_1_old: '3',
      field_1_new: '4',
      field_1_diff: 1,
    });
  });

  it('shows only Ref Des added and removed items in Old and New columns', () => {
    const comparison = comparePcaRows({
      leftRows: [{ 'Part Number': 'P1', 'Ref Des': 'R1 R2 R3' }],
      rightRows: [{ 'Part Number': 'P1', 'Ref Des': 'R2 R3 R4' }],
      keyField: 'Part Number',
      selectedFields: ['Ref Des'],
    });

    const report = createPcaReportTable(comparison);

    expect(report.columns.map(column => column.header)).toEqual([
      'Part Number',
      'Ref Des Old',
      'Ref Des New',
      'Ref Des Diff',
    ]);
    expect(report.rows[0].field_0_old).toBe('R1');
    expect(report.rows[0].field_0_new).toBe('R4');
    expect(report.rows[0].field_0_diff).toBe('Added: R4; Removed: R1');
  });
});

describe('createPcaExportWorkbook', () => {
  it('creates a wide workbook containing only changed BOM rows', async () => {
    const comparison = comparePcaRows({
      leftRows: [
        { 'Part Number': 'P1', Quantity: '1', Description: 'Same' },
        { 'Part Number': 'P2', Quantity: '2', Description: 'Same' },
      ],
      rightRows: [
        { 'Part Number': 'P1', Quantity: '1', Description: 'Same' },
        { 'Part Number': 'P2', Quantity: '3', Description: 'Same' },
      ],
      keyField: 'Part Number',
      selectedFields: ['Part Number', 'Quantity', 'Description'],
    });

    const buffer = await createPcaExportWorkbook(comparison);
    const workbook = XLSX.read(buffer, { type: 'array' });
    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json<Record<string, string>>(worksheet, { defval: '' });

    expect(workbook.SheetNames[0]).toBe('AST Comparison');
    expect(rows).toHaveLength(1);
    expect(Object.keys(rows[0])).toEqual([
      'Part Number',
      'Qty Old',
      'Qty New',
      'Qty Diff',
      'Description Old',
      'Description New',
    ]);
    expect(rows[0]).toEqual({
      'Part Number': 'P2',
      'Qty Old': '2',
      'Qty New': '3',
      'Qty Diff': 1,
      'Description Old': 'Same',
      'Description New': 'Same',
    });
  });
});

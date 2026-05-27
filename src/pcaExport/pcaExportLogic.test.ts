import * as XLSX from 'xlsx';
import {
  comparePcaRows,
  createPcaExportWorkbook,
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

describe('createPcaExportWorkbook', () => {
  it('creates a workbook containing only comparison rows', async () => {
    const comparison = comparePcaRows({
      leftRows: [{ 'Part Number': 'P1', Quantity: '1' }],
      rightRows: [{ 'Part Number': 'P1', Quantity: '2' }],
      keyField: 'Part Number',
      selectedFields: ['Quantity'],
    });

    const buffer = await createPcaExportWorkbook(comparison, {
      leftLabel: 'Rev A',
      rightLabel: 'Rev B',
    });
    const workbook = XLSX.read(buffer, { type: 'array' });
    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json<Record<string, string>>(worksheet, { defval: '' });

    expect(rows).toHaveLength(1);
    expect(Object.keys(rows[0])).toEqual(['Status', 'Key', 'Field', 'Rev A', 'Rev B']);
  });
});

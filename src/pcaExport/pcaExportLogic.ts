import ExcelJS from 'exceljs';
import * as XLSX from 'xlsx';

export type PcaCellValue = string | number | boolean | Date | null | undefined;
export type PcaRow = Record<string, PcaCellValue>;

export interface ParsedPcaWorkbook {
  sheetName: string;
  headers: string[];
  rows: PcaRow[];
}

export interface PcaCompareInput {
  leftRows: PcaRow[];
  rightRows: PcaRow[];
  keyField: string;
  selectedFields: string[];
}

export interface PcaComparisonValue {
  left: string;
  right: string;
  changed: boolean;
}

export interface PcaComparisonRow {
  key: string;
  status: 'changed' | 'added' | 'removed';
  values: Record<string, PcaComparisonValue>;
}

export interface PcaComparisonResult {
  keyField: string;
  selectedFields: string[];
  rows: PcaComparisonRow[];
}

const preferredSheetName = 'Bill of Materials';

const stringifyCell = (value: PcaCellValue): string => {
  if (value === null || value === undefined) return '';
  return String(value).trim();
};

const countSignificantCells = (row: PcaCellValue[]): number =>
  row.filter(cell => {
    if (cell === null || cell === undefined) return false;
    return /[a-zA-Z]/.test(String(cell));
  }).length;

const dedupeHeaders = (headers: string[]): string[] => {
  const counts: Record<string, number> = {};
  return headers.map((header, index) => {
    const safeHeader = header || `Column ${index + 1}`;
    counts[safeHeader] = (counts[safeHeader] || 0) + 1;
    return counts[safeHeader] === 1 ? safeHeader : `${safeHeader}-${counts[safeHeader]}`;
  });
};

const findHeaderRowIndex = (rows: PcaCellValue[][]): number => {
  let bestIndex = 0;
  let bestScore = -1;

  rows.forEach((row, index) => {
    const score = countSignificantCells(row);
    if (score > bestScore) {
      bestIndex = index;
      bestScore = score;
    }
  });

  return bestIndex;
};

export const parsePcaWorkbook = (input: ArrayBuffer): ParsedPcaWorkbook => {
  const workbook = XLSX.read(input, { type: 'array', cellDates: true, raw: true });
  const sheetName = workbook.SheetNames.includes(preferredSheetName)
    ? preferredSheetName
    : workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];

  if (!worksheet) {
    throw new Error('No worksheet found in PCA workbook.');
  }

  const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1');
  const scanRange = {
    ...range,
    e: { ...range.e, r: Math.min(range.e.r, 49) },
  };
  const scanRows = XLSX.utils.sheet_to_json<PcaCellValue[]>(worksheet, {
    range: scanRange,
    header: 1,
    defval: '',
  });
  const headerRowIndex = findHeaderRowIndex(scanRows);
  const headers = dedupeHeaders((scanRows[headerRowIndex] || []).map(stringifyCell));
  const dataRange = {
    ...range,
    s: { ...range.s, r: headerRowIndex + 1 },
  };
  const parsedRows = XLSX.utils.sheet_to_json<PcaRow>(worksheet, {
    range: dataRange,
    header: headers,
    defval: '',
  });
  const rows = parsedRows.filter(row =>
    Object.values(row).some(value => stringifyCell(value) !== '')
  );

  return { sheetName, headers, rows };
};

const expandRangeToken = (token: string): string[] => {
  if (!token.includes('-')) return [token];

  const parts = token.split('-');
  if (parts.length !== 2) return [token];

  const [start, end] = parts.map(part => part.trim());
  const startMatch = start.match(/^([A-Za-z_]*)(\d+)$/);
  const endMatch = end.match(/^([A-Za-z_]*)(\d+)$/);

  if (!startMatch || !endMatch) return [token];

  const startPrefix = startMatch[1];
  const endPrefix = endMatch[1];
  if (startPrefix !== endPrefix) return [token];

  const startNumber = parseInt(startMatch[2], 10);
  const endNumber = parseInt(endMatch[2], 10);
  const step = startNumber <= endNumber ? 1 : -1;
  const expanded: string[] = [];

  for (let value = startNumber; step > 0 ? value <= endNumber : value >= endNumber; value += step) {
    expanded.push(`${startPrefix}${value}`);
  }

  return expanded;
};

export const normalizeRangeAwareValue = (value: PcaCellValue): string => {
  const raw = stringifyCell(value);
  if (!raw) return '';

  return raw
    .split(/[\s,;]+/)
    .map(token => token.trim())
    .filter(Boolean)
    .flatMap(expandRangeToken)
    .join(' ');
};

export const comparePcaRows = ({
  leftRows,
  rightRows,
  keyField,
  selectedFields,
}: PcaCompareInput): PcaComparisonResult => {
  const rightByKey = new Map<string, PcaRow>();
  const leftByKey = new Map<string, PcaRow>();

  rightRows.forEach(row => {
    const key = stringifyCell(row[keyField]);
    if (key) rightByKey.set(key, row);
  });
  leftRows.forEach(row => {
    const key = stringifyCell(row[keyField]);
    if (key) leftByKey.set(key, row);
  });

  const resultRows: PcaComparisonRow[] = [];

  const maxLength = Math.max(leftRows.length, rightRows.length);

  for (let index = 0; index < maxLength; index++) {
    const leftRow = leftRows[index];
    const rightRowAtPosition = rightRows[index];

    if (leftRow) {
      const key = stringifyCell(leftRow[keyField]);
      if (key) {
        const rightRow = rightByKey.get(key);
        const values = buildComparisonValues(leftRow, rightRow, selectedFields);

        if (!rightRow) {
          resultRows.push({ key, status: 'removed', values });
        } else if (Object.values(values).some(value => value.changed)) {
          resultRows.push({ key, status: 'changed', values });
        }
      }
    }

    if (rightRowAtPosition) {
      const key = stringifyCell(rightRowAtPosition[keyField]);
      if (key && !leftByKey.has(key)) {
        resultRows.push({
          key,
          status: 'added',
          values: buildComparisonValues(undefined, rightRowAtPosition, selectedFields),
        });
      }
    }
  }


  return { keyField, selectedFields, rows: resultRows };
};

const buildComparisonValues = (
  leftRow: PcaRow | undefined,
  rightRow: PcaRow | undefined,
  selectedFields: string[]
): Record<string, PcaComparisonValue> => {
  return selectedFields.reduce<Record<string, PcaComparisonValue>>((values, field) => {
    const left = stringifyCell(leftRow?.[field]);
    const right = stringifyCell(rightRow?.[field]);
    values[field] = {
      left,
      right,
      changed: normalizeRangeAwareValue(left) !== normalizeRangeAwareValue(right),
    };
    return values;
  }, {});
};

export const createPcaExportWorkbook = async (
  comparison: PcaComparisonResult,
  labels: { leftLabel: string; rightLabel: string }
): Promise<ArrayBuffer> => {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('PCA Comparison');
  const rows: Array<Record<string, string>> = [];

  comparison.rows.forEach(row => {
    comparison.selectedFields.forEach(field => {
      const value = row.values[field];
      if (!value || !value.changed) return;

      rows.push({
        Status: row.status,
        Key: row.key,
        Field: field,
        [labels.leftLabel]: value.left,
        [labels.rightLabel]: value.right,
      });
    });
  });

  worksheet.columns = [
    { header: 'Status', key: 'Status', width: 12 },
    { header: 'Key', key: 'Key', width: 24 },
    { header: 'Field', key: 'Field', width: 28 },
    { header: labels.leftLabel, key: labels.leftLabel, width: 32 },
    { header: labels.rightLabel, key: labels.rightLabel, width: 32 },
  ];
  worksheet.addRows(rows);

  worksheet.getRow(1).eachCell(cell => {
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'B1F0F0' },
    };
    cell.font = { bold: true, color: { argb: '000000' } };
    cell.border = {
      top: { style: 'thin' },
      left: { style: 'thin' },
      bottom: { style: 'thin' },
      right: { style: 'thin' },
    };
  });

  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    row.eachCell({ includeEmpty: true }, cell => {
      cell.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' },
      };
    });
  });

  return workbook.xlsx.writeBuffer() as Promise<ArrayBuffer>;
};

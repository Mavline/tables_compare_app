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

export interface PcaReportColumn {
  header: string;
  key: string;
  width: number;
}

export interface PcaReportTable {
  columns: PcaReportColumn[];
  rows: Array<Record<string, string | number>>;
}

const preferredSheetName = 'Bill of Materials';

const stringifyCell = (value: PcaCellValue): string => {
  if (value === null || value === undefined) return '';
  return String(value).trim();
};

const normalizeHeader = (value: string): string =>
  value.toLowerCase().replace(/[_\s-]/g, '');

export const isPcaComparableField = (field: string, keyField: string): boolean => {
  const trimmedField = field.trim();
  if (!trimmedField) return false;
  if (trimmedField === '#') return false;
  return normalizeHeader(trimmedField) !== normalizeHeader(keyField);
};

const findPreferredSheetName = (sheetNames: string[]): string | undefined =>
  sheetNames.includes(preferredSheetName) ? preferredSheetName : sheetNames[0];

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

export const getPcaWorkbookSheetNames = (input: ArrayBuffer): string[] => {
  const workbook = XLSX.read(input, { type: 'array', cellDates: true, raw: true });
  return workbook.SheetNames;
};

export const parsePcaWorkbook = (input: ArrayBuffer, requestedSheetName?: string): ParsedPcaWorkbook => {
  const workbook = XLSX.read(input, { type: 'array', cellDates: true, raw: true });
  const sheetName = requestedSheetName && workbook.SheetNames.includes(requestedSheetName)
    ? requestedSheetName
    : findPreferredSheetName(workbook.SheetNames);

  if (!sheetName) {
    throw new Error('No worksheet found in AST workbook.');
  }

  const worksheet = workbook.Sheets[sheetName];

  if (!worksheet) {
    throw new Error('No worksheet found in AST workbook.');
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
  const fieldsToCompare = selectedFields.filter(field => isPcaComparableField(field, keyField));
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
        const values = buildComparisonValues(leftRow, rightRow, fieldsToCompare);

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
          values: buildComparisonValues(undefined, rightRowAtPosition, fieldsToCompare),
        });
      }
    }
  }


  return { keyField, selectedFields: fieldsToCompare, rows: resultRows };
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

export const isQuantityField = (field: string): boolean => {
  const normalized = normalizeHeader(field);
  return normalized === 'quantity' || normalized === 'qty';
};

const isRefDesField = (field: string): boolean => {
  const normalized = normalizeHeader(field);
  return normalized === 'refdes' || normalized === 'referencedesignator' || normalized === 'referencedesignators';
};

export const isDescriptionField = (field: string): boolean => {
  const normalized = normalizeHeader(field);
  return [
    'description',
    'desc',
    'itemdescription',
    'componentdescription',
    'partdescription',
  ].includes(normalized);
};

export const isPcaReportContextField = (field: string): boolean =>
  isQuantityField(field) || isDescriptionField(field);

const reportFieldLabel = (field: string): string => {
  if (isQuantityField(field)) return 'Qty';
  if (isRefDesField(field)) return 'Ref Des';
  return field;
};

const numberOrZero = (value: string): number | null => {
  if (value === '') return 0;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const quantityDiff = (left: string, right: string): string | number => {
  const leftNumber = numberOrZero(left);
  const rightNumber = numberOrZero(right);
  if (leftNumber === null || rightNumber === null) return '';
  return rightNumber - leftNumber;
};

const rangeAwareTokens = (value: PcaCellValue): string[] =>
  normalizeRangeAwareValue(value)
    .split(/\s+/)
    .map(token => token.trim())
    .filter(Boolean);

const tokenDifference = (source: string[], comparison: string[]): string =>
  source.filter(item => !comparison.includes(item)).join(', ');

const hasFieldChange = (comparison: PcaComparisonResult, field: string): boolean =>
  comparison.rows.some(row => row.values[field]?.changed);

const reportFields = (comparison: PcaComparisonResult): string[] =>
  comparison.selectedFields.filter(field =>
    isPcaReportContextField(field) || hasFieldChange(comparison, field)
  );

const diffValue = (
  field: string,
  value: PcaComparisonValue,
  rowStatus: PcaComparisonRow['status']
): string | number => {
  if (isQuantityField(field)) {
    return quantityDiff(value.left, value.right);
  }

  if (isRefDesField(field)) {
    const leftTokens = rangeAwareTokens(value.left);
    const rightTokens = rangeAwareTokens(value.right);
    const added = tokenDifference(rightTokens, leftTokens);
    const removed = tokenDifference(leftTokens, rightTokens);
    return [
      added ? `Added: ${added}` : '',
      removed ? `Removed: ${removed}` : '',
    ].filter(Boolean).join('; ');
  }

  if (rowStatus === 'added') return 'Added';
  if (rowStatus === 'removed') return 'Removed';
  return 'Changed';
};

const oldNewReportValue = (
  field: string,
  value: PcaComparisonValue,
  side: 'old' | 'new'
): string => {
  if (!value.changed) {
    return isPcaReportContextField(field) ? (side === 'old' ? value.left : value.right) : '';
  }

  if (!isRefDesField(field)) {
    return side === 'old' ? value.left : value.right;
  }

  const leftTokens = rangeAwareTokens(value.left);
  const rightTokens = rangeAwareTokens(value.right);
  const added = tokenDifference(rightTokens, leftTokens);
  const removed = tokenDifference(leftTokens, rightTokens);

  if (!added && !removed) {
    return side === 'old' ? value.left : value.right;
  }

  return side === 'old' ? removed : added;
};

export const createPcaReportTable = (comparison: PcaComparisonResult): PcaReportTable => {
  const columns: PcaReportColumn[] = [
    { header: comparison.keyField, key: 'key', width: 24 },
  ];
  const fieldsToReport = reportFields(comparison);

  fieldsToReport.forEach((field, index) => {
    const label = reportFieldLabel(field);
    const includeDiff = hasFieldChange(comparison, field);

    columns.push(
      { header: `${label} Old`, key: `field_${index}_old`, width: isRefDesField(field) ? 48 : 16 },
      { header: `${label} New`, key: `field_${index}_new`, width: isRefDesField(field) ? 48 : 16 }
    );

    if (includeDiff) {
      columns.push({ header: `${label} Diff`, key: `field_${index}_diff`, width: isRefDesField(field) ? 42 : 16 });
    }
  });

  const rows = comparison.rows
    .filter(row => comparison.selectedFields.some(field => row.values[field]?.changed))
    .map(row => {
      const reportRow: Record<string, string | number> = { key: row.key };

      fieldsToReport.forEach((field, index) => {
        const value = row.values[field] || { left: '', right: '', changed: false };
        reportRow[`field_${index}_old`] = oldNewReportValue(field, value, 'old');
        reportRow[`field_${index}_new`] = oldNewReportValue(field, value, 'new');

        if (hasFieldChange(comparison, field)) {
          reportRow[`field_${index}_diff`] = value.changed ? diffValue(field, value, row.status) : '';
        }
      });

      return reportRow;
    });

  return { columns, rows };
};

export const createPcaExportWorkbook = async (comparison: PcaComparisonResult): Promise<ArrayBuffer> => {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('AST Comparison');
  workbook.creator = 'Elisra BOM Compare';
  workbook.created = new Date();

  const reportTable = createPcaReportTable(comparison);

  worksheet.columns = reportTable.columns;
  worksheet.addRows(reportTable.rows);

  worksheet.getRow(1).eachCell(cell => {
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'B1F0F0' },
    };
    cell.font = { bold: true, size: 8.43, color: { argb: '000000' } };
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
      cell.alignment = { vertical: 'top', wrapText: true };
    });
  });

  return workbook.xlsx.writeBuffer() as Promise<ArrayBuffer>;
};

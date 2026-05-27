import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { saveAs } from 'file-saver';
import {
  comparePcaRows,
  createPcaExportWorkbook,
  parsePcaWorkbook,
  ParsedPcaWorkbook,
  PcaComparisonResult,
  PcaComparisonRow,
} from './pcaExportLogic';

interface LoadedPcaFile {
  file: File;
  parsed: ParsedPcaWorkbook;
}

interface PreviewRow {
  status: PcaComparisonRow['status'];
  key: string;
  field: string;
  left: string;
  right: string;
}

const pageStyle: React.CSSProperties = {
  minHeight: '100vh',
  backgroundColor: '#0D1117',
  color: '#E6EDF3',
  padding: '96px 32px 48px',
};

const panelStyle: React.CSSProperties = {
  backgroundColor: '#161B22',
  border: '1px solid #30363D',
  borderRadius: '8px',
  padding: '20px',
};

const buttonStyle: React.CSSProperties = {
  padding: '10px 18px',
  backgroundColor: '#4B3B80',
  color: '#E6EDF3',
  border: 'none',
  borderRadius: '4px',
  cursor: 'pointer',
  fontWeight: 'bold',
};

const selectStyle: React.CSSProperties = {
  width: '100%',
  padding: '8px',
  border: '1px solid #7E57C2',
  borderRadius: '4px',
  backgroundColor: '#1C2128',
  color: '#E6EDF3',
};

const PcaExportCompare: React.FC = () => {
  const [loadedFiles, setLoadedFiles] = useState<Array<LoadedPcaFile | null>>([null, null]);
  const [keyField, setKeyField] = useState('');
  const [selectedFields, setSelectedFields] = useState<string[]>([]);
  const [comparison, setComparison] = useState<PcaComparisonResult | null>(null);
  const [error, setError] = useState('');

  const commonHeaders = useMemo(() => {
    const [left, right] = loadedFiles;
    if (!left || !right) return left?.parsed.headers || right?.parsed.headers || [];

    const rightHeaders = new Set(right.parsed.headers);
    return left.parsed.headers.filter(header => rightHeaders.has(header));
  }, [loadedFiles]);

  const previewRows = useMemo<PreviewRow[]>(() => {
    if (!comparison) return [];

    return comparison.rows.flatMap(row =>
      comparison.selectedFields
        .map(field => ({ field, value: row.values[field] }))
        .filter(({ value }) => value?.changed)
        .map(({ field, value }) => ({
          status: row.status,
          key: row.key,
          field,
          left: value.left,
          right: value.right,
        }))
    );
  }, [comparison]);

  const handleUpload = async (fileIndex: number, file: File | undefined) => {
    if (!file) return;

    try {
      setError('');
      const parsed = parsePcaWorkbook(await file.arrayBuffer());
      setLoadedFiles(previous => {
        const next = [...previous];
        next[fileIndex] = { file, parsed };
        return next;
      });
      setKeyField('');
      setSelectedFields([]);
      setComparison(null);
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : 'Failed to read PCA Export workbook.');
    }
  };

  const toggleField = (field: string) => {
    setComparison(null);
    setSelectedFields(previous =>
      previous.includes(field)
        ? previous.filter(selected => selected !== field)
        : [...previous, field]
    );
  };

  const selectAllFields = () => {
    setComparison(null);
    setSelectedFields(commonHeaders);
  };

  const clearFields = () => {
    setComparison(null);
    setSelectedFields([]);
  };

  const runComparison = () => {
    const [left, right] = loadedFiles;
    if (!left || !right) {
      setError('Upload two PCA Export workbooks first.');
      return;
    }
    if (!keyField) {
      setError('Select a key field before comparing.');
      return;
    }
    if (selectedFields.length === 0) {
      setError('Select at least one field to compare.');
      return;
    }

    setError('');
    setComparison(comparePcaRows({
      leftRows: left.parsed.rows,
      rightRows: right.parsed.rows,
      keyField,
      selectedFields,
    }));
  };

  const downloadComparison = async () => {
    const [left, right] = loadedFiles;
    if (!comparison || !left || !right) {
      setError('Run comparison before downloading.');
      return;
    }

    const buffer = await createPcaExportWorkbook(comparison, {
      leftLabel: left.file.name,
      rightLabel: right.file.name,
    });
    saveAs(
      new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
      'pca_export_comparison.xlsx'
    );
  };

  return (
    <main style={pageStyle}>
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
        <div style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' }}>
          <div>
            <h1 style={{ margin: 0, color: '#A78BFA' }}>PCA Export comparison</h1>
          </div>
          <Link to="/" style={{ ...buttonStyle, textDecoration: 'none', height: 'fit-content' }}>
            Главная
          </Link>
        </div>

        <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px', marginBottom: '20px' }}>
          {[0, 1].map(index => {
            const loaded = loadedFiles[index];
            return (
              <div key={index} style={panelStyle}>
                <h2 style={{ marginTop: 0 }}>File {index + 1}</h2>
                <input
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={event => handleUpload(index, event.target.files?.[0])}
                  style={{ marginBottom: '16px', color: '#E6EDF3' }}
                />
                {loaded ? (
                  <dl style={{ margin: 0, color: '#C9D1D9' }}>
                    <dt>Selected file</dt>
                    <dd>{loaded.file.name}</dd>
                    <dt>Sheet</dt>
                    <dd>{loaded.parsed.sheetName}</dd>
                    <dt>Columns</dt>
                    <dd>{loaded.parsed.headers.length}</dd>
                    <dt>Rows</dt>
                    <dd>{loaded.parsed.rows.length}</dd>
                  </dl>
                ) : (
                  <p style={{ color: '#8B949E' }}>No file selected</p>
                )}
              </div>
            );
          })}
        </section>

        <section style={{ ...panelStyle, marginBottom: '20px' }}>
          <h2 style={{ marginTop: 0 }}>Manual comparison settings</h2>
          <label style={{ display: 'block', marginBottom: '16px' }}>
            <span style={{ display: 'block', marginBottom: '8px' }}>Key field</span>
            <select value={keyField} onChange={event => setKeyField(event.target.value)} style={selectStyle}>
              <option value="">Select key field</option>
              {commonHeaders.map(header => (
                <option key={header} value={header}>{header}</option>
              ))}
            </select>
          </label>

          <div style={{ display: 'flex', gap: '10px', marginBottom: '12px', flexWrap: 'wrap' }}>
            <button type="button" style={buttonStyle} onClick={selectAllFields} disabled={commonHeaders.length === 0}>
              Select all fields
            </button>
            <button type="button" style={buttonStyle} onClick={clearFields}>
              Clear fields
            </button>
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
            gap: '8px',
          }}>
            {commonHeaders.map(header => (
              <label key={header} style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px',
                backgroundColor: '#1C2128',
                borderRadius: '4px',
              }}>
                <input
                  type="checkbox"
                  checked={selectedFields.includes(header)}
                  onChange={() => toggleField(header)}
                />
                <span>{header}</span>
              </label>
            ))}
          </div>
        </section>

        {error && (
          <div style={{
            ...panelStyle,
            borderColor: '#F85149',
            color: '#FFB4B4',
            marginBottom: '20px',
          }}>
            {error}
          </div>
        )}

        <section style={{ ...panelStyle, marginBottom: '20px' }}>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
            <button type="button" style={buttonStyle} onClick={runComparison}>
              Compare selected fields
            </button>
            <button
              type="button"
              style={buttonStyle}
              onClick={downloadComparison}
              disabled={!comparison || comparison.rows.length === 0}
            >
              Download
            </button>
            {comparison && (
              <span style={{ color: '#C9D1D9' }}>
                Difference rows: {comparison.rows.length}
              </span>
            )}
          </div>
        </section>

        {comparison && (
          <section style={panelStyle}>
            <h2 style={{ marginTop: 0 }}>Preview</h2>
            {previewRows.length === 0 ? (
              <p style={{ color: '#C9D1D9' }}>No differences found in selected fields.</p>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
                  <thead>
                    <tr>
                      {['Status', 'Key', 'Field', 'File 1', 'File 2'].map(header => (
                        <th key={header} style={tableHeaderStyle}>{header}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {previewRows.slice(0, 100).map((row, index) => (
                      <tr key={`${row.key}-${row.field}-${index}`}>
                        <td style={tableCellStyle}>{row.status}</td>
                        <td style={tableCellStyle}>{row.key}</td>
                        <td style={tableCellStyle}>{row.field}</td>
                        <td style={tableCellStyle}>{row.left}</td>
                        <td style={tableCellStyle}>{row.right}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}
      </div>
    </main>
  );
};

const tableHeaderStyle: React.CSSProperties = {
  backgroundColor: '#30363D',
  color: '#E6EDF3',
  padding: '10px',
  border: '1px solid #484F58',
  textAlign: 'left',
};

const tableCellStyle: React.CSSProperties = {
  padding: '10px',
  border: '1px solid #30363D',
  verticalAlign: 'top',
  whiteSpace: 'pre-wrap',
};

export default PcaExportCompare;

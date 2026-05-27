import React, { useMemo, useState } from 'react';
import { saveAs } from 'file-saver';
import {
  comparePcaRows,
  createPcaExportWorkbook,
  createPcaReportTable,
  getPcaWorkbookSheetNames,
  isPcaComparableField,
  isPcaReportContextField,
  parsePcaWorkbook,
  ParsedPcaWorkbook,
  PcaComparisonResult,
  PcaReportTable,
} from './pcaExportLogic';

interface LoadedPcaFile {
  file: File;
  workbookData: ArrayBuffer;
  sheetNames: string[];
  parsed: ParsedPcaWorkbook;
}

const panelStyle: React.CSSProperties = {
  width: '100%',
  backgroundColor: '#1C2128',
  padding: '20px',
  borderRadius: '8px',
  marginBottom: '20px',
  color: '#E6EDF3',
  textAlign: 'left',
  boxSizing: 'border-box',
};

const fileCardStyle: React.CSSProperties = {
  backgroundColor: '#161B22',
  padding: '20px',
  borderRadius: '8px',
  boxSizing: 'border-box',
  minWidth: 0,
};

const buttonStyleBase: React.CSSProperties = {
  padding: '10px 20px',
  backgroundColor: '#4B3B80',
  color: '#E6EDF3',
  border: 'none',
  borderRadius: '4px',
  cursor: 'pointer',
  fontSize: '14px',
  fontWeight: 'bold',
};

const disabledButtonStyle: React.CSSProperties = {
  ...buttonStyleBase,
  backgroundColor: '#30363D',
  color: '#8B949E',
  cursor: 'not-allowed',
};

const selectStyle: React.CSSProperties = {
  width: '100%',
  padding: '8px',
  border: '1px solid #7E57C2',
  borderRadius: '4px',
  backgroundColor: '#1C2128',
  color: '#E6EDF3',
  fontSize: '14px',
  boxSizing: 'border-box',
};

const hiddenFileInputStyle: React.CSSProperties = {
  position: 'absolute',
  top: 0,
  left: 0,
  width: '100%',
  height: '100%',
  opacity: 0,
  cursor: 'pointer',
  zIndex: 2,
};

const fileButtonWrapperStyle: React.CSSProperties = {
  position: 'relative',
  marginBottom: '20px',
  width: '100%',
  maxWidth: '520px',
};

const fileButtonStyle: React.CSSProperties = {
  padding: '10px 15px',
  backgroundColor: '#4B3B80',
  color: '#E6EDF3',
  border: 'none',
  borderRadius: '4px',
  cursor: 'pointer',
  textAlign: 'center',
  fontSize: '14px',
  fontWeight: 'bold',
  width: '100%',
  position: 'relative',
  zIndex: 1,
  boxSizing: 'border-box',
};

const metaGridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '100px minmax(0, 1fr)',
  gap: '8px 14px',
  alignItems: 'start',
  color: '#C9D1D9',
  fontSize: '14px',
};

const metaLabelStyle: React.CSSProperties = {
  color: '#8B949E',
};

const metaValueStyle: React.CSSProperties = {
  color: '#E6EDF3',
  fontWeight: 600,
  wordBreak: 'break-word',
};

const sectionTitleStyle: React.CSSProperties = {
  margin: '0 0 16px',
  color: '#E6EDF3',
  fontSize: '20px',
};

const mappedSectionTitleStyle: React.CSSProperties = {
  color: '#E6EDF3',
  margin: '0 0 15px',
  fontSize: '18px',
  fontWeight: 'bold',
  textAlign: 'center',
};

const fieldCardStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '10px',
  padding: '10px 12px',
  backgroundColor: '#1C2128',
  borderRadius: '4px',
  minHeight: '42px',
  minWidth: 0,
};

const PcaExportCompare: React.FC = () => {
  const [loadedFiles, setLoadedFiles] = useState<Array<LoadedPcaFile | null>>([null, null]);
  const [keyField, setKeyField] = useState('');
  const [selectedFields, setSelectedFields] = useState<string[]>([]);
  const [comparison, setComparison] = useState<PcaComparisonResult | null>(null);
  const [error, setError] = useState('');

  const commonHeaders = useMemo(() => {
    const [left, right] = loadedFiles;
    if (!left || !right) return [];

    const rightHeaders = new Set(right.parsed.headers);
    return left.parsed.headers.filter(header => rightHeaders.has(header));
  }, [loadedFiles]);

  const comparableHeaders = useMemo(
    () => commonHeaders.filter(header => isPcaComparableField(header, keyField)),
    [commonHeaders, keyField]
  );

  const previewTable = useMemo<PcaReportTable | null>(() => {
    if (!comparison) return null;
    return createPcaReportTable(comparison);
  }, [comparison]);

  const alwaysIncludedFields = useMemo(
    () => commonHeaders.filter(header => isPcaReportContextField(header) && isPcaComparableField(header, keyField)),
    [commonHeaders, keyField]
  );

  const comparisonFields = useMemo(
    () => Array.from(new Set([...selectedFields, ...alwaysIncludedFields])),
    [alwaysIncludedFields, selectedFields]
  );

  const handleUpload = async (fileIndex: number, file: File | undefined) => {
    if (!file) return;

    try {
      setError('');
      const workbookData = await file.arrayBuffer();
      const sheetNames = getPcaWorkbookSheetNames(workbookData);
      const parsed = parsePcaWorkbook(workbookData);
      setLoadedFiles(previous => {
        const next = [...previous];
        next[fileIndex] = { file, workbookData, sheetNames, parsed };
        return next;
      });
      setKeyField('');
      setSelectedFields([]);
      setComparison(null);
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : 'Failed to read AST workbook.');
    }
  };

  const handleSheetSelection = (fileIndex: number, sheetName: string) => {
    const loaded = loadedFiles[fileIndex];
    if (!loaded) return;

    try {
      setError('');
      const parsed = parsePcaWorkbook(loaded.workbookData, sheetName);
      setLoadedFiles(previous => {
        const next = [...previous];
        next[fileIndex] = { ...loaded, parsed };
        return next;
      });
      setKeyField('');
      setSelectedFields([]);
      setComparison(null);
    } catch (sheetError) {
      setError(sheetError instanceof Error ? sheetError.message : 'Failed to read selected worksheet.');
    }
  };

  const toggleField = (field: string) => {
    if (!isPcaComparableField(field, keyField)) return;
    setComparison(null);
    setSelectedFields(previous =>
      previous.includes(field)
        ? previous.filter(selected => selected !== field)
        : [...previous, field]
    );
  };

  const selectAllFields = () => {
    setComparison(null);
    setSelectedFields(comparableHeaders);
  };

  const clearFields = () => {
    setComparison(null);
    setSelectedFields([]);
  };

  const runComparison = () => {
    const [left, right] = loadedFiles;
    if (!left || !right) {
      setError('Upload two AST workbooks first.');
      return;
    }
    if (!keyField) {
      setError('Select a key field before comparing.');
      return;
    }
    if (comparisonFields.length === 0) {
      setError('Select at least one field to compare.');
      return;
    }

    setError('');
    setComparison(comparePcaRows({
      leftRows: left.parsed.rows,
      rightRows: right.parsed.rows,
      keyField,
      selectedFields: comparisonFields,
    }));
  };

  const downloadComparison = async () => {
    const [left, right] = loadedFiles;
    if (!comparison || !left || !right) {
      setError('Run comparison before downloading.');
      return;
    }

    const buffer = await createPcaExportWorkbook(comparison);
    saveAs(
      new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
      'ast_bom_comparison.xlsx'
    );
  };

  return (
    <div className="App">
      <header className="App-header" style={{ boxSizing: 'border-box' }}>
        <h1 style={{ margin: '0 0 24px', color: '#A78BFA' }}>AST BOM Comparison</h1>

        <section style={panelStyle}>
          <h2 style={{ color: '#7E57C2', margin: '0 0 15px', fontSize: '20px' }}>
            Quick Start Guide:
          </h2>
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
            alignItems: 'flex-start',
            lineHeight: '1.8',
            fontSize: '16px',
          }}>
            <span>Upload the two AST BOM workbooks you want to compare</span>
            <span>Select the worksheet to compare in each workbook</span>
            <span>Select the shared key field used to match rows</span>
            <span>Check the shared columns you want included in the comparison</span>
            <span>Click "Compare" to preview differences, then "Download" for the Excel report</span>
          </div>
        </section>

        <section style={panelStyle}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
            gap: '20px',
          }}>
            {[0, 1].map(index => {
              const loaded = loadedFiles[index];
              return (
                <div key={index} style={fileCardStyle}>
                  <h2 style={sectionTitleStyle}>File {index + 1}</h2>
                  <label
                    htmlFor={`pca-file-input-${index}`}
                    style={{ display: 'block', marginBottom: '8px', color: '#E6EDF3' }}
                  >
                    Choose Excel file:
                  </label>
                  <div style={fileButtonWrapperStyle}>
                    <input
                      id={`pca-file-input-${index}`}
                      type="file"
                      accept=".xlsx,.xls"
                      onChange={event => handleUpload(index, event.target.files?.[0])}
                      style={hiddenFileInputStyle}
                    />
                    <div style={fileButtonStyle}>Choose File</div>
                  </div>

                  {!loaded && (
                    <p style={{ color: '#E6EDF3', margin: '0 0 15px' }}>No file selected</p>
                  )}

                  {loaded && (
                    <>
                      <p style={{
                        color: '#7E57C2',
                        margin: '0 0 15px',
                        fontSize: '14px',
                        fontWeight: 'bold',
                        wordBreak: 'break-word',
                      }}>
                        Selected file: {loaded.file.name}
                      </p>
                      <label
                        htmlFor={`pca-sheet-select-${index}`}
                        style={{ display: 'block', marginBottom: '8px', color: '#E6EDF3' }}
                      >
                        Select worksheet:
                      </label>
                      <select
                        id={`pca-sheet-select-${index}`}
                        value={loaded.parsed.sheetName}
                        onChange={event => handleSheetSelection(index, event.target.value)}
                        style={{ ...selectStyle, marginBottom: '15px' }}
                      >
                        {loaded.sheetNames.map(sheetName => (
                          <option key={sheetName} value={sheetName}>{sheetName}</option>
                        ))}
                      </select>
                      <div style={metaGridStyle}>
                        <span style={metaLabelStyle}>Columns</span>
                        <span style={metaValueStyle}>{loaded.parsed.headers.length}</span>
                        <span style={metaLabelStyle}>Rows</span>
                        <span style={metaValueStyle}>{loaded.parsed.rows.length}</span>
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        <section className="field-mapping-container" style={{
          backgroundColor: '#161B22',
          padding: '20px',
          borderRadius: '8px',
          marginBottom: '20px',
          width: '100%',
          boxSizing: 'border-box',
        }}>
          <h3 style={mappedSectionTitleStyle}>Fields to Compare</h3>

          <div style={{ marginBottom: '18px' }}>
            <label
              htmlFor="pca-key-field"
              style={{ display: 'block', marginBottom: '8px', color: '#E6EDF3', textAlign: 'center' }}
            >
              Select a key field:
            </label>
            <select
              id="pca-key-field"
              value={keyField}
              onChange={event => {
                const nextKeyField = event.target.value;
                setKeyField(nextKeyField);
                setSelectedFields(previous =>
                  previous.filter(field => isPcaComparableField(field, nextKeyField))
                );
                setComparison(null);
              }}
              style={selectStyle}
            >
              <option value="">Select a column</option>
              {commonHeaders.map(header => (
                <option key={header} value={header}>{header}</option>
              ))}
            </select>
          </div>

          <div style={{
            display: 'flex',
            justifyContent: 'center',
            gap: '10px',
            marginBottom: '18px',
            flexWrap: 'wrap',
          }}>
            <button
              type="button"
              style={comparableHeaders.length === 0 ? disabledButtonStyle : buttonStyleBase}
              onClick={selectAllFields}
              disabled={comparableHeaders.length === 0}
            >
              Select All Fields
            </button>
            <button type="button" style={buttonStyleBase} onClick={clearFields}>
              Clear Selection
            </button>
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: '8px',
          }}>
            {comparableHeaders.map(header => (
              <label key={header} style={fieldCardStyle}>
                <input
                  type="checkbox"
                  checked={selectedFields.includes(header) || alwaysIncludedFields.includes(header)}
                  disabled={alwaysIncludedFields.includes(header)}
                  onChange={() => toggleField(header)}
                />
                <span style={{ overflowWrap: 'anywhere' }}>{header}</span>
              </label>
            ))}
          </div>
        </section>

        {error && (
          <section style={{
            ...panelStyle,
            border: '1px solid #F85149',
            color: '#FFB4B4',
          }}>
            {error}
          </section>
        )}

        <section className="controls-container" style={{
          width: '100%',
          backgroundColor: '#1C2128',
          padding: '20px',
          borderRadius: '8px',
          marginBottom: '20px',
          boxSizing: 'border-box',
        }}>
          <div className="button-container" style={{
            display: 'flex',
            justifyContent: 'center',
            gap: '16px',
            alignItems: 'center',
            flexWrap: 'wrap',
          }}>
            <button type="button" style={buttonStyleBase} onClick={runComparison}>
              Compare
            </button>
            <button
              type="button"
              style={!previewTable || previewTable.rows.length === 0 ? disabledButtonStyle : buttonStyleBase}
              onClick={downloadComparison}
              disabled={!previewTable || previewTable.rows.length === 0}
            >
              Download
            </button>
          </div>
          {comparison && (
            <div style={{ color: '#C9D1D9', marginTop: '12px', textAlign: 'center' }}>
              Rows with differences: {previewTable?.rows.length || 0}
            </div>
          )}
        </section>

        {comparison && (
          <section style={{ ...panelStyle, textAlign: 'center' }}>
            <h2 style={sectionTitleStyle}>Preview</h2>
            {!previewTable || previewTable.rows.length === 0 ? (
              <p style={{ color: '#C9D1D9', margin: 0 }}>No differences found in the selected fields.</p>
            ) : (
              <div style={{ overflowX: 'auto', textAlign: 'left' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
                  <thead>
                    <tr>
                      {previewTable.columns.map(column => (
                        <th key={column.key} style={tableHeaderStyle}>{column.header}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {previewTable.rows.slice(0, 100).map((row, rowIndex) => (
                      <tr key={`${row.key}-${rowIndex}`}>
                        {previewTable.columns.map(column => (
                          <td key={column.key} style={tableCellStyle}>{row[column.key]}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}
      </header>
    </div>
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

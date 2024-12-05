"use client";

import React, { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import JSZip from 'jszip';
import { XMLParser } from 'fast-xml-parser';
import Input from "./components/ui/input";
import './App.css';
import ExcelJS from 'exceljs';
import { useTableContext } from './context/TableContext';

// Define the GroupInfo type
interface GroupInfo {
  level: number;
  group: number[];
  hidden: boolean;
  parent?: number;
}

// Define the TableRow type
type TableRow = Record<string, any>;

const App: React.FC = () => {

  const [files, setFiles] = useState<File[]>([]);
  const [tables, setTables] = useState<TableRow[][]>([]);
  const [fields, setFields] = useState<{ [key: string]: string[] }>({});
  const [selectedFields, setSelectedFields] = useState<{ [key: string]: string[] }>({});
  const [keyFields, setKeyFields] = useState<{ [key: string]: string }>({});
  const [sheets, setSheets] = useState<{ [key: string]: string[] }>({});
  const [selectedSheets, setSelectedSheets] = useState<{ [key: string]: string }>({});
  const [mergedPreview, setMergedPreview] = useState<TableRow[]>([]);
  const [selectedFieldsOrder, setSelectedFieldsOrder] = useState<string[]>([]);
  const [groupingStructure, setGroupingStructure] = useState<{ [key: string]: { [key: string]: GroupInfo } }>({});
  const [columnToProcess, setColumnToProcess] = useState<string>('');
  const [secondColumnToProcess, setSecondColumnToProcess] = useState<string>('');

  const { mergedData, saveMergedData, clearData } = useTableContext();

  useEffect(() => {
    // Logging component lifecycle
    console.log('App State:', {
      mergedData: mergedData ? {
        length: mergedData.length,
        sample: mergedData.slice(0, 1)
      } : null,
      selectedFieldsOrder,
      files: files.map(f => f.name),
      tables: tables.map(t => t.length)
    });
  }, [mergedData, selectedFieldsOrder, files, tables]);

  useEffect(() => {
    const allSelectedFields: string[] = [];

    // Собираем все выбранные поля из обеих таблиц с префиксами
    files.forEach((file, index) => {
      const fileFields = selectedFields[file.name] || [];
      // Добавляем поля с префиксами, кроме служебных полей
      const prefixedFields = fileFields.map(field => {
        if (field.startsWith('Level_') || field === 'LevelValue') {
          return field;
        }
        return `${index === 0 ? 'Left' : 'Right'}.${field}`;
      });
      allSelectedFields.push(...prefixedFields);
    });

    // Обновляем selectedFieldsOrder
    setSelectedFieldsOrder(allSelectedFields);
  }, [selectedFields, files]);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    console.log("File upload started");
    const newFiles = Array.from(event.target.files || []);
    console.log("New files:", newFiles.map(f => f.name));

    for (const file of newFiles) {
      console.log(`Processing file: ${file.name}`);
      const reader = new FileReader();
      reader.onload = async (e) => {
        console.log(`File ${file.name} loaded`);
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetNames = workbook.SheetNames;
        console.log(`Sheets in ${file.name}:`, sheetNames);

        setFiles(prevFiles => [...prevFiles, file]);
        setSheets(prevSheets => ({
          ...prevSheets,
          [file.name]: sheetNames
        }));
      };
      reader.readAsArrayBuffer(file);
    }
  };

  const processSheet = async (file: File, sheetName: string) => {
    try {
      const arrayBuffer = await file.arrayBuffer();
      console.log(`ArrayBuffer obtained for ${file.name}`);

      const zip = new JSZip();
      const zipContents = await zip.loadAsync(arrayBuffer);

      console.log('Files in ZIP:', Object.keys(zipContents.files));

      let sheetXmlPath = `xl/worksheets/sheet${sheetName}.xml`;
      if (!zipContents.files[sheetXmlPath]) {
        const sheetIndex = 1;
        sheetXmlPath = `xl/worksheets/sheet${sheetIndex}.xml`;
      }

      console.log(`Trying to access sheet XML at path: ${sheetXmlPath}`);
      const sheetXml = await zipContents.file(sheetXmlPath)?.async('string');

      const workbook = XLSX.read(arrayBuffer, { type: 'array' });
      const worksheet = workbook.Sheets[sheetName];

      const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1');
      const endRow = Math.min(range.e.r, 49);
      const tempRange = { ...range, e: { ...range.e, r: endRow } };
      const partialJson = XLSX.utils.sheet_to_json(worksheet, { range: tempRange, header: 1 }) as any[][];

      const containsLetters = (str: string) => /[a-zA-Z]/.test(str);

      const countSignificantCells = (row: any[]) =>
        row.filter(
          (cell) => cell && typeof cell === "string" && containsLetters(cell),
        ).length;

      let headerRowIndex = 0;
      let maxSignificantCells = 0;

      partialJson.forEach((row, index) => {
        const significantCells = countSignificantCells(row);
        if (significantCells > maxSignificantCells) {
          maxSignificantCells = significantCells;
          headerRowIndex = index;
        }
      });

      const headerRow = partialJson[headerRowIndex];
      let headers: string[] = headerRow.map(cell => String(cell || '').trim());

      const headerCount: { [key: string]: number } = {};
      headers = headers.map(header => {
        if (headerCount[header]) {
          headerCount[header] += 1;
          return `${header}-${headerCount[header]}`;
        } else {
          headerCount[header] = 1;
          return header;
        }
      });

      const fullRange = {
        ...range,
        s: { ...range.s, r: headerRowIndex + 1 },
      };
      const jsonData = XLSX.utils.sheet_to_json<TableRow>(worksheet, {
        range: fullRange,
        header: headers,
      });

      console.log('Header row index:', headerRowIndex);
      console.log('JSON Data length:', jsonData.length);
      console.log('First few rows:', jsonData.slice(0, 5));

      setTables(prevTables => {
        console.log('Setting table data:', jsonData);
        return [...prevTables, jsonData];
      });

      setFields(prevFields => ({
        ...prevFields,
        [file.name]: headers
      }));
      setSelectedFields(prevSelected => ({
        ...prevSelected,
        [file.name]: [],
      }));
      setKeyFields(prevKeys => ({
        ...prevKeys,
        [file.name]: '',
      }));

      setSelectedSheets(prevSelected => ({
        ...prevSelected,
        [file.name]: sheetName
      }));

      if (sheetXml) {
        const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_' });
        const parsedXml = parser.parse(sheetXml);

        if (parsedXml.worksheet && parsedXml.worksheet.sheetData && parsedXml.worksheet.sheetData.row) {
          const rows = parsedXml.worksheet.sheetData.row;
          const groupingInfo = extractGroupingInfo(rows, headerRowIndex);

          setGroupingStructure(prevStructure => ({
            ...prevStructure,
            [file.name]: groupingInfo
          }));
        }
      }

    } catch (error) {
      console.error('Error in processSheet:', error);
    }
  };

  const extractGroupingInfo = (rows: any[], headerOffset: number): { [key: string]: GroupInfo } => {
    const groupingInfo: { [key: string]: GroupInfo } = {};

    rows.forEach((row: any) => {
      const rowIndex = parseInt(row['@_r']);

      if (rowIndex <= headerOffset) {
        return;
      }

      const outlineLevel = parseInt(row['@_outlineLevel'] || '0');

      const adjustedIndex = rowIndex - headerOffset;
      groupingInfo[adjustedIndex.toString()] = {
        level: outlineLevel,
        group: [adjustedIndex],
        hidden: row['@_hidden'] === '1'
      };
    });

    return groupingInfo;
  };

  const handleSheetSelection = (fileName: string, sheetName: string) => {
    const file = files.find(f => f.name === fileName);
    if (file) {
      processSheet(file, sheetName);
    } else {
      console.error(`File not found: ${fileName}`);
    }
  };

  const handleFieldSelection = (fileName: string, field: string) => {
    setSelectedFields((prevFields) => {
      const currentFields = prevFields[fileName] || [];
      const isFieldSelected = currentFields.includes(field);
      
      return {
        ...prevFields,
        [fileName]: isFieldSelected 
          ? currentFields.filter(f => f !== field)
          : [...currentFields, field]
      };
    });
  };

  const handleKeyFieldSelection = (fileName: string, field: string) => {
    setKeyFields((prevKeys) => ({
      ...prevKeys,
      [fileName]: prevKeys[fileName] === field ? '' : field
    }));
  };

  const handleColumnToProcessChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    setColumnToProcess(prev => prev === value ? '' : value);
  };

  const handleSecondColumnToProcessChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    setSecondColumnToProcess(prev => prev === value ? '' : value);
  };

  const createBaseRow = (rowIndex: number): TableRow => {
    const row: TableRow = {};
    const groupInfo = files[0] ? groupingStructure[files[0].name] : undefined;

    if (groupInfo) {
      const groupHeaders = Array.from(
        { length: Math.max(...Object.values(groupInfo).map(info => info.level)) + 1 }, 
        (_, i) => `Level_${i + 1}`
      );

      groupHeaders.forEach((header) => {
        row[header] = '';
      });

      const groupData = groupInfo[(rowIndex + 2).toString()];
      
      if (groupData) {
        const level = groupData.level;
        if (level >= 0 && level < groupHeaders.length) {
          const levelValue = groupData.level + 1;
          row[groupHeaders[level]] = levelValue;
          const dots = '.'.repeat(levelValue + 1);
          row['LevelValue'] = `${dots}${levelValue}`;
        }
      } else {
        const firstTable = tables[0];
        const keyField = keyFields[files[0].name];
        if (firstTable && keyField && firstTable[rowIndex]) {
          const keyValue = firstTable[rowIndex][keyField];
          if (keyValue && keyValue.toString().trim() !== '') {
            row['LevelValue'] = '..1';
          }
        }
      }
    }

    return row;
  };

  const mergeTables = async () => {
    console.log('Starting merge process...');

    if (tables.length < 2) {
      alert("Please upload both tables to merge.");
      return;
    }

    const keyFieldSet = new Set(Object.values(keyFields));
    if (keyFieldSet.size === 0) {
      alert("Please select at least one key field for merging.");
      return;
    }

    const firstTable = tables[0];
    const secondTable = tables[1];
    const firstKeyField = keyFields[files[0].name];
    const secondKeyField = keyFields[files[1].name];

    // Создаем карты для быстрого поиска по ключам
    const firstTableMap = new Map(firstTable.map(row => [row[firstKeyField], row]));
    const secondTableMap = new Map(secondTable.map(row => [row[secondKeyField], row]));

    // Определяем максимальную длину таблиц
    const maxLength = Math.max(firstTable.length, secondTable.length);

    // Создаем результирующий массив
    const resultRows: TableRow[] = [];

    // Обрабатываем каждую позицию
    for (let i = 0; i < maxLength; i++) {
      const firstRow = firstTable[i];
      const secondRow = secondTable[i];
      
      if (firstRow) {
        const baseRow = createBaseRow(resultRows.length);
        const firstKey = firstRow[firstKeyField];
        const matchingSecondRow = secondTableMap.get(firstKey);

        // Добавляем данные из первой таблицы
        fields[files[0].name].forEach(field => {
          if (selectedFields[files[0].name].includes(field)) {
            if (field.startsWith('Level_') || field === 'LevelValue') {
              baseRow[field] = firstRow[field];
            } else {
              baseRow[`Left.${field}`] = firstRow[field];
            }
          }
        });

        // Добавляем данные из второй таблицы (если есть соответствие)
        fields[files[1].name].forEach(field => {
          if (selectedFields[files[1].name].includes(field)) {
            if (field.startsWith('Level_') || field === 'LevelValue') {
              baseRow[field] = matchingSecondRow ? matchingSecondRow[field] : '';
            } else {
              baseRow[`Right.${field}`] = matchingSecondRow ? matchingSecondRow[field] : '';
            }
          }
        });

        resultRows.push(baseRow);
      }

      if (secondRow && !firstTableMap.has(secondRow[secondKeyField])) {
        const baseRow = createBaseRow(resultRows.length);

        // Пустые значения для первой таблицы
        fields[files[0].name].forEach(field => {
          if (selectedFields[files[0].name].includes(field)) {
            if (field.startsWith('Level_') || field === 'LevelValue') {
              baseRow[field] = '';
            } else {
              baseRow[`Left.${field}`] = '';
            }
          }
        });

        // Данные из второй таблицы
        fields[files[1].name].forEach(field => {
          if (selectedFields[files[1].name].includes(field)) {
            if (field.startsWith('Level_') || field === 'LevelValue') {
              baseRow[field] = secondRow[field];
            } else {
              baseRow[`Right.${field}`] = secondRow[field];
            }
          }
        });

        resultRows.push(baseRow);
      }
    }

    // Формируем заголовки
    const groupedFile = files[0];
    const groupInfo = groupingStructure[groupedFile.name];
    const maxLevel = groupInfo ? Math.max(...Object.values(groupInfo).map(info => info.level)) : 0;
    const groupHeaders = Array.from({ length: maxLevel + 1 }, (_, i) => `Level_${i + 1}`);

    const dataHeaders: string[] = [];
    files.forEach((file, index) => {
      const fileFields = fields[file.name].filter(field => selectedFields[file.name].includes(field));
      const prefixedFields = fileFields.map(field => {
        if (field.startsWith('Level_') || field === 'LevelValue') {
          return field;
        }
        return `${index === 0 ? 'Left' : 'Right'}.${field}`;
      });
      dataHeaders.push(...prefixedFields);
    });

    const allHeaders = [...groupHeaders, 'LevelValue', ...dataHeaders];

    // Обработка диапазонов если нужно
    const resultData = columnToProcess || secondColumnToProcess
      ? resultRows.map((row) => {
          if (columnToProcess) {
            const cellValue = row[columnToProcess];
            if (typeof cellValue === 'string' && cellValue.includes('-')) {
              row[columnToProcess] = expandRanges(cellValue);
            }
          }
          if (secondColumnToProcess) {
            const cellValue = row[secondColumnToProcess];
            if (typeof cellValue === 'string' && cellValue.includes('-')) {
              row[secondColumnToProcess] = expandRanges(cellValue);
            }
          }
          return row;
        })
      : resultRows;

    // Фильтруем строки с полным совпадением
    const filteredData = resultData.filter(row => {
      const leftFields = selectedFieldsOrder.filter(field => field.startsWith('Left.'));
      const rightFields = selectedFieldsOrder.filter(field => field.startsWith('Right.'));

      return leftFields.some(leftField => {
        const rightField = leftField.replace('Left.', 'Right.');
        const leftValue = row[leftField]?.toString().trim() || '';
        const rightValue = row[rightField]?.toString().trim() || '';
        return leftValue !== rightValue;
      });
    });

    // Сохраняем результат
    setMergedPreview(filteredData);
    await saveMergedData(filteredData);
    setSelectedFieldsOrder(allHeaders);
  };

  const downloadMergedFile = async () => {
    if (!mergedPreview || mergedPreview.length === 0) {
      alert('No data to download. Please merge tables first.');
      return;
    }
  
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Merged');
  
    // Находим ключевые поля
    const keyFieldPairs = Object.entries(keyFields).map(([fileName, field]) => {
      const prefix = fileName === files[0].name ? 'Left.' : 'Right.';
      return prefix + field;
    });
  
    // Собираем пары колонок для копирования в конец, исключая ключевые поля
    const comparePairs: string[][] = [];
    selectedFieldsOrder.forEach(field => {
      if (field.startsWith('Left.') && !keyFieldPairs.includes(field)) {
        const rightField = field.replace('Left.', 'Right.');
        if (selectedFieldsOrder.includes(rightField)) {
          comparePairs.push([field, rightField]);
        }
      }
    });
  
    // Создаем расширенные данные - копируем исходные и добавляем те же данные в новые колонки
    const exportData = mergedPreview.map(row => {
      const newRow = { ...row }; // Копируем все исходные данные
      
      // Добавляем те же данные в дополнительные колонки
      comparePairs.forEach(([leftField, rightField]) => {
        newRow[`Compare_${leftField}`] = row[leftField];
        newRow[`Compare_${rightField}`] = row[rightField];
      });
      
      return newRow;
    });
  
    // Формируем все заголовки: исходные + дополнительные
    const compareHeaders = comparePairs.flatMap(([leftField, rightField]) => 
      [`Compare_${leftField}`, `Compare_${rightField}`]
    );
    
    const allHeaders = [...selectedFieldsOrder, ...compareHeaders];
  
    worksheet.columns = allHeaders.map(header => ({
      header,
      key: header
    }));
  
    worksheet.addRows(exportData);
  
    // Стандартное форматирование без изменений
    worksheet.getRow(1).eachCell((cell) => {
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'B1F0F0' }
      };
      cell.font = {
        bold: true,
        size: 8.43,
        color: { argb: '000000' }
      };
      cell.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' }
      };
    });
  
    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;
      row.eachCell({ includeEmpty: true }, cell => {
        cell.border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' }
        };
      });
    });
  
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { 
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
    });
    saveAs(blob, 'merged_tables.xlsx');
  };
  

  const expandRanges = (value: string): string => {
    const parts = value.split(',');
    const expandedParts: string[] = [];

    parts.forEach((part) => {
      part = part.trim();
      if (part.includes('-')) {
        const [start, end] = part.split('-').map((s) => s.trim());

        const startMatch = start.match(/^([A-Za-z]*)(\d+)$/);
        const endMatch = end.match(/^([A-Za-z]*)(\d+)$/);

        if (startMatch && endMatch) {
          const startPrefix = startMatch[1];
          const startNum = parseInt(startMatch[2], 10);

          const endPrefix = endMatch[1];
          const endNum = parseInt(endMatch[2], 10);

          if (startPrefix === endPrefix) {
            if (startNum <= endNum) {
              for (let i = startNum; i <= endNum; i++) {
                expandedParts.push(`${startPrefix}${i}`);
              }
            } else {
              for (let i = startNum; i >= endNum; i--) {
                expandedParts.push(`${startPrefix}${i}`);
              }
            }
          } else {
            expandedParts.push(part);
          }
        } else {
          expandedParts.push(part);
        }
      } else {
        expandedParts.push(part);
      }
    });

    return expandedParts.join(',');
  };

  // Добавим функцию для сброса состояния
  const handleReset = () => {
    clearData();
    // Очищаем все состояния
    setFiles([]);
    setTables([]);
    setFields({});
    setSelectedFields({});
    setKeyFields({});
    setSheets({});
    setSelectedSheets({});
    setMergedPreview([]);
    setSelectedFieldsOrder([]);
    setGroupingStructure({});
    setColumnToProcess('');
    setSecondColumnToProcess('');
    
    // Перезагружаем страницу
    window.location.reload();
  };

  return (
    <div className="App">
      <header className="App-header">
        {/* Добавляем кнопку RESET */}
        <div className="reset-container" style={{ 
          width: '100%',
          padding: '20px',
          backgroundColor: '#015f60',
          marginBottom: '20px',
          display: 'flex',
          alignItems: 'center',
          gap: '20px'
        }}>
          <button
            onClick={handleReset}
            style={{
              padding: "12px 24px",
              backgroundColor: "#dc3545",
              color: "white",
              border: "none",
              borderRadius: "4px",
              fontSize: "16px",
              fontWeight: "bold",
              cursor: "pointer",
              boxShadow: "0 2px 4px rgba(0,0,0,0.2)",
            }}
          >
            RESET
          </button>
          <span style={{
            fontSize: "30px",
            color: "#59fafc",
            fontStyle: "Arial"
          }}>
            Start over, refresh process or clear memory
          </span>
        </div>

        <h1 className="text-3xl font-bold mb-6">Excel Table Merger</h1>
        <div className="file-container-wrapper">
          {[0, 1].map((index) => (
            <div key={index} className="file-container">
              <h2 className="text-xl font-semibold mb-4">File {index + 1}</h2>
              <label htmlFor={`file-input-${index}`} className="mb-2 block">
                Choose Excel file:
              </label>
              <Input
                id={`file-input-${index}`}
                type="file"
                accept=".xlsx,.xls"
                onChange={handleFileUpload}
                className="mb-4 w-full p-2 border border-gray-300 rounded"
                style={{
                  backgroundColor: "#59fafc",
                  color: "black"
                }}
              />
              {!files[index] && (
                <p className="text-gray-500 mb-4">No file selected</p>
              )}
              {files[index] && sheets[files[index].name] && (
                <div className="mb-4" style={{ width: "100%" }}>
                  <select
                    value={selectedSheets[files[index].name] || ""}
                    onChange={(e) =>
                      handleSheetSelection(files[index].name, e.target.value)
                    }
                    style={{
                      width: "100%",
                      padding: "8px",
                      border: "1px solid #ccc",
                      borderRadius: "4px",
                      backgroundColor: "#59fafc",
                      color: "black",
                      fontSize: "14px",
                    }}
                  >
                    <option value="">Select a sheet</option>
                    {sheets[files[index].name].map((sheet, sheetIndex) => (
                      <option key={`${sheet}-${sheetIndex}`} value={sheet}>{sheet}</option>
                    ))}
                  </select>
                </div>
              )}

              {files[index] && selectedSheets[files[index].name] && (
                <div className="file-content">
                  <div className="fields-column">
                    <h3 className="font-medium mb-2">Fields:</h3>
                    {fields[files[index].name]?.map((field, fieldIndex) => (
                      <div key={`${field}-${fieldIndex}`} className="field-item">
                        {field}
                      </div>
                    ))}
                  </div>
                  <div className="checkbox-column">
                    <h3 className="font-medium mb-2">Select:</h3>
                    {fields[files[index].name]?.map((field) => (
                      <div key={field} className="checkbox-container">
                        <input
                          type="checkbox"
                          id={`field-${files[index].name}-${field}`}
                          className="checkbox"
                          checked={selectedFields[files[index].name]?.includes(field)}
                          onChange={() => handleFieldSelection(files[index].name, field)}
                        />
                      </div>
                    ))}
                  </div>
                  <div className="key-column">
                    <h3 className="font-medium mb-2">Key field:</h3>
                    <select
                      value={keyFields[files[index].name] || ""}
                      onChange={(e) =>
                        handleKeyFieldSelection(
                          files[index].name,
                          e.target.value,
                        )
                      }
                      style={{
                        width: "100%",
                        padding: "8px",
                        border: "1px solid #ccc",
                        borderRadius: "4px",
                        backgroundColor: "#59fafc",
                        color: "black",
                        fontSize: "14px",
                      }}
                    >
                      <option value="">Select a key field</option>
                      {fields[files[index].name]?.map((field, fieldIndex) => (
                        <option key={`key-${index}-${field}-${fieldIndex}`} value={field}>
                          {field}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
        <div className="controls-container">
          {/* Первый селектор столбца */}
          <div className="range-selector" style={{ marginBottom: '10px' }}>
            <select
              value={columnToProcess}
              onChange={handleColumnToProcessChange}
              style={{
                width: "100%",
                padding: "8px",
                border: "1px solid #ccc",
                borderRadius: "4px",
                backgroundColor: "#59fafc",
                color: "black",
                fontSize: "14px",
              }}
            >
              <option value="">Select First Column to Expand Ranges</option>
              {selectedFieldsOrder.map((field, index) => (
                <option key={`first-${field}-${index}`} value={field}>
                  {field}
                </option>
              ))}
            </select>
          </div>

          {/* Второй селектор столбца */}
          <div className="range-selector" style={{ marginBottom: '10px' }}>
            <select
              value={secondColumnToProcess}
              onChange={handleSecondColumnToProcessChange}
              style={{
                width: "100%",
                padding: "8px",
                border: "1px solid #ccc",
                borderRadius: "4px",
                backgroundColor: "#59fafc",
                color: "black",
                fontSize: "14px",
              }}
            >
              <option value="">Select Second Column to Expand Ranges</option>
              {selectedFieldsOrder.map((field, index) => (
                <option key={`second-${field}-${index}`} value={field}>
                  {field}
                </option>
              ))}
            </select>
          </div>

          {/* Кнпки управления */}
          <div className="button-container">
            <button
              onClick={mergeTables}
              disabled={files.length < 2}
              style={{
                padding: "8px 16px",
                backgroundColor: "#59fafc",
                marginRight: "10px",
              }}
            >
              Merge
            </button>
            <button
              onClick={downloadMergedFile}
              disabled={!mergedPreview}
              style={{
                padding: "8px 16px",
                backgroundColor: "#59fafc",
                marginRight: "10px",
              }}
            >
              Download
            </button>
          </div>
        </div>
      </header>

      {mergedPreview && mergedPreview.length > 0 && (
        <div className="merged-preview" style={{ margin: "20px 0" }}>
          <h2 className="text-xl font-semibold mb-4">Merged Data Preview</h2>
          <div style={{ overflowX: "auto" }}>
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                fontSize: "14px",
              }}
            >
              <thead>
                <tr>
                  {selectedFieldsOrder
                    .filter(field => field !== columnToProcess && field !== secondColumnToProcess)
                    .map((field: string) => (
                    <th
                      key={field}
                      style={{
                        padding: "12px 8px",
                        borderBottom: "2px solid #ddd",
                        textAlign: "left",
                        backgroundColor: '#B1F0F0',
                        color: 'black',
                      }}
                    >
                      {field}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {mergedPreview.slice(0, 10).map((row, rowIndex) => (
                  <tr key={rowIndex}>
                    {selectedFieldsOrder
                      .filter(field => field !== columnToProcess && field !== secondColumnToProcess)
                      .map((field: string, cellIndex: number) => (
                      <td
                        key={`${rowIndex}-${cellIndex}`}
                        style={{
                          padding: "8px",
                          borderBottom: "1px solid #ddd",
                          borderLeft: "1px solid #ddd",
                          borderRight: "1px solid #ddd",
                        }}
                      >
                        {row[field] !== undefined ? String(row[field]) : ""}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {mergedPreview.length > 10 && (
            <p style={{ marginTop: "10px", color: "#666" }}>
              Showing first 10 of {mergedPreview.length} rows
            </p>
          )}
        </div>
      )}
    </div>
  );
};
export default App;


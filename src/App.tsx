"use client";

import React, { useState, useEffect } from 'react';
import { Routes, Route } from 'react-router-dom';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import JSZip from 'jszip';
import { XMLParser } from 'fast-xml-parser';
import Input from "./components/ui/input";
import './App.css';
import ExcelJS from 'exceljs';
import { useTableContext } from './context/TableContext';
import Navigation from './components/Navigation';
import About from './components/About';

// Define the GroupInfo type
interface GroupInfo {
  level: number;
  group: number[];
  hidden: boolean;
  parent?: number;
}

// Define field mapping interface
interface FieldMapping {
  leftField: string;
  rightField: string;
  isActive: boolean;
}

// Define the TableRow type
type TableRow = Record<string, any>;

const MainContent: React.FC = () => {
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
  const [fieldMappings, setFieldMappings] = useState<FieldMapping[]>([]);
  const [fileIds, setFileIds] = useState<{ [key: number]: string }>({});

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

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>, index: number) => {
    console.log("File upload started for index:", index);
    const file = event.target.files?.[0];
    if (!file) return;

    console.log("Processing new file:", file.name);
    const reader = new FileReader();
    reader.onload = async (e) => {
      console.log(`File ${file.name} loaded`);
      const data = new Uint8Array(e.target?.result as ArrayBuffer);
      const workbook = XLSX.read(data, { type: 'array' });
      const sheetNames = workbook.SheetNames;
      console.log(`Sheets in ${file.name}:`, sheetNames);

      // Обновляем состояние для конкретного индекса
      setFiles(prevFiles => {
        const newFiles = [...prevFiles];
        newFiles[index] = file;
        return newFiles;
      });

      // Очищаем связанные состояния для этого файла
      setSheets(prevSheets => ({
        ...prevSheets,
        [file.name]: sheetNames
      }));
      setSelectedSheets(prev => {
        const newSelected = { ...prev };
        delete newSelected[file.name];
        return newSelected;
      });
      setFields(prev => {
        const newFields = { ...prev };
        delete newFields[file.name];
        return newFields;
      });
      setSelectedFields(prev => {
        const newSelected = { ...prev };
        delete newSelected[file.name];
        return newSelected;
      });
      setKeyFields(prev => {
        const newKeys = { ...prev };
        delete newKeys[file.name];
        return newKeys;
      });
      setTables(prevTables => {
        const newTables = [...prevTables];
        newTables[index] = [];
        return newTables;
      });
      setGroupingStructure(prev => {
        const newStructure = { ...prev };
        delete newStructure[file.name];
        return newStructure;
      });
      
      // Сбрасываем предварительный просмотр
      setMergedPreview([]);
    };
    reader.readAsArrayBuffer(file);
  };

  const processSheet = async (file: File, sheetName: string) => {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer, { type: 'array' });
      const worksheet = workbook.Sheets[sheetName];

      // Находим заголовки
      const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1');
      const endRow = Math.min(range.e.r, 49);
      const tempRange = { ...range, e: { ...range.e, r: endRow } };
      const partialJson = XLSX.utils.sheet_to_json(worksheet, { range: tempRange, header: 1 }) as any[][];

      const containsLetters = (str: string) => /[a-zA-Z]/.test(str);

      const countSignificantCells = (row: any[]) =>
        row.filter(cell => cell && typeof cell === "string" && containsLetters(cell)).length;

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

      // Обрабатываем дубликаты в заголовках
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

      // Получаем данные с правильными заголовками
      const fullRange = {
        ...range,
        s: { ...range.s, r: headerRowIndex + 1 },
      };
      const jsonData = XLSX.utils.sheet_to_json<TableRow>(worksheet, {
        range: fullRange,
        header: headers,
      });

      // Обновляем состояния
      const fileIndex = files.findIndex(f => f.name === file.name);
      setTables(prevTables => {
        const newTables = [...prevTables];
        newTables[fileIndex] = jsonData;
        return newTables;
      });

      setFields(prevFields => ({
        ...prevFields,
        [file.name]: headers
      }));

      // Обрабатываем группировку
      const zip = new JSZip();
      const zipContents = await zip.loadAsync(arrayBuffer);
      let sheetXmlPath = `xl/worksheets/sheet${sheetName}.xml`;
      if (!zipContents.files[sheetXmlPath]) {
        const sheetIndex = 1;
        sheetXmlPath = `xl/worksheets/sheet${sheetIndex}.xml`;
      }

      const sheetXml = await zipContents.file(sheetXmlPath)?.async('string');
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
      console.error('Error processing sheet:', error);
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

  const handleSheetSelection = async (fileName: string, sheetName: string) => {
    console.log(`Sheet selection changed for ${fileName} to ${sheetName}`);
    const file = files.find(f => f.name === fileName);
    if (!file) {
      console.error(`File not found: ${fileName}`);
      return;
    }

    // Очищаем связанные состояния перед обработкой нового листа
    const fileIndex = files.findIndex(f => f.name === fileName);
    setTables(prevTables => {
      const newTables = [...prevTables];
      newTables[fileIndex] = [];
      return newTables;
    });
    setFields(prev => {
      const newFields = { ...prev };
      delete newFields[fileName];
      return newFields;
    });
    setSelectedFields(prev => {
      const newSelected = { ...prev };
      delete newSelected[fileName];
      return newSelected;
    });
    setKeyFields(prev => {
      const newKeys = { ...prev };
      delete newKeys[fileName];
      return newKeys;
    });
    setGroupingStructure(prev => {
      const newStructure = { ...prev };
      delete newStructure[fileName];
      return newStructure;
    });

    // Сбрасываем предварительный просмотр
    setMergedPreview([]);

    // Обновляем выбранный лист
    setSelectedSheets(prev => ({
      ...prev,
      [fileName]: sheetName
    }));

    // Обрабатываем новый лист
    await processSheet(file, sheetName);
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

  const validateFileIds = () => {
    if (!fileIds[0] || !fileIds[1]) {
      alert('Please enter identifiers for both files');
      return false;
    }
    return true;
  };

  const handleFileIdChange = (index: number, value: string) => {
    setFileIds(prev => ({
      ...prev,
      [index]: value
    }));
  };

  const mergeTables = async () => {
    if (!validateFileIds()) {
      return;
    }

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

    // Создаем маппинг полей для быстрого доступа
    const fieldMappingDict = Object.fromEntries(
      fieldMappings
        .filter(m => m.isActive && m.leftField && m.rightField)
        .map(m => [m.leftField, m.rightField])
    );

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
              // Проверяем, есть ли маппинг для этого поля
              const mappedField = fieldMappingDict[field];
              if (mappedField) {
                // Если есть маппинг, используем оригинальное имя поля для левой стороны
                baseRow[`Left.${field}`] = firstRow[field];
                // И маппинговое имя поля для правой стороны
                baseRow[`Right.${mappedField}`] = matchingSecondRow ? matchingSecondRow[mappedField] : '';
              } else {
                // Если нет маппинга, используем стандартную логику
                baseRow[`Left.${field}`] = firstRow[field];
                baseRow[`Right.${field}`] = matchingSecondRow ? matchingSecondRow[field] : '';
              }
            }
          }
        });

        resultRows.push(baseRow);
      }

      if (secondRow && !firstTableMap.has(secondRow[secondKeyField])) {
        const baseRow = createBaseRow(resultRows.length);

        // Пустые значения для первой таблицы и данные из второй с учетом маппинга
        fields[files[0].name].forEach(field => {
          if (selectedFields[files[0].name].includes(field)) {
            if (field.startsWith('Level_') || field === 'LevelValue') {
              baseRow[field] = '';
            } else {
              const mappedField = fieldMappingDict[field];
              if (mappedField) {
                baseRow[`Left.${field}`] = '';
                baseRow[`Right.${mappedField}`] = secondRow[mappedField];
              } else {
                baseRow[`Left.${field}`] = '';
                baseRow[`Right.${field}`] = secondRow[field];
              }
            }
          }
        });

        resultRows.push(baseRow);
      }
    }

    // Формируем заголовки с учетом маппинга
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
        // Учитываем маппинг при формировании заголовков
        if (index === 0) {
          return `Left.${field}`;
        } else {
          const mappedField = Object.entries(fieldMappingDict).find(([_, right]) => right === field)?.[0] || field;
          return `Right.${mappedField}`;
        }
      });
      dataHeaders.push(...prefixedFields);
    });

    const allHeaders = [...groupHeaders, 'LevelValue', ...dataHeaders];

    // Остальной код без изменений...
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
  
    if (!validateFileIds()) {
      return;
    }
  
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Merged');

    // Функция для поиска полей описания
    const findDescriptionField = (fields: string[]): string | undefined => {
      const possibleNames = [
        'Description', 'DESC', 'DESCRIPTION', 'Desc',
        'Name', 'NAME', 'ITEM_NAME', 'Item Name',
        'Title', 'TITLE',
        'תיאור', 'שם', 'כותרת', // Hebrew variants
        'Item_Description', 'ItemDesc', 'Item_Name',
        'Component_Description', 'Component_Name',
        'Part_Description', 'Part_Name',
        'Product_Description', 'Product_Name',
        'Details', 'Specification',
        'Label', 'Text_Description'
      ];
      return fields.find(field => 
        possibleNames.some(name => 
          field.toLowerCase().replace(/[_\s-]/g, '').includes(name.toLowerCase().replace(/[_\s-]/g, ''))
        )
      );
    };
  
    // Находим ключевые поля
    const keyFieldPairs = Object.entries(keyFields).map(([fileName, field]) => {
      const prefix = fileName === files[0].name ? 'Left.' : 'Right.';
      return prefix + field;
    });
  
    // Собираем пары колонок для копирования в конец
    const comparePairs: string[][] = [];
    selectedFieldsOrder.forEach(field => {
      if (field.startsWith('Left.') && !keyFieldPairs.includes(field)) {
        const rightField = field.replace('Left.', 'Right.');
        if (selectedFieldsOrder.includes(rightField)) {
          comparePairs.push([field, rightField]);
        }
      }
    });
  
    // Получаем имя ключевого поля без префикса
    const keyFieldName = keyFields[files[0].name].replace('Left.', '').replace('Right.', '');
  
    // Находим поля описания
    const leftDescField = findDescriptionField(
      selectedFieldsOrder.filter(f => f.startsWith('Left.'))
    )?.replace('Left.', '');
    const rightDescField = findDescriptionField(
      selectedFieldsOrder.filter(f => f.startsWith('Right.'))
    )?.replace('Right.', '');

    const descFieldName = leftDescField || rightDescField || 'Description';
  
    // Функция для обработки строк RefDes
    const processRefDesString = (refDes: string): string[] => {
      if (!refDes) return [];
      const expandedRefDes = expandRanges(refDes);
      return expandedRefDes.split(/[\s,;]+/)
        .map(item => item.trim())
        .filter(item => item && /^[A-Za-z0-9_]+$/.test(item));
    };
  
    // Создаем расширенные данные
    const exportData = mergedPreview.map(row => {
      const newRow: Record<string, any> = {};
      
      // Копируем Level поля
      selectedFieldsOrder.forEach(field => {
        if (field.startsWith('Level')) {
          newRow[field] = (row as Record<string, any>)[field];
        }
      });
  
      // Добавляем ключевое поле
      const leftKeyField = `Left.${keyFieldName}`;
      const rightKeyField = `Right.${keyFieldName}`;
      newRow[keyFieldName] = (row as Record<string, any>)[leftKeyField] || (row as Record<string, any>)[rightKeyField];
      
      // Обрабатываем поле описания
      const leftDesc = leftDescField ? (row as Record<string, any>)[`Left.${leftDescField}`] : '';
      const rightDesc = rightDescField ? (row as Record<string, any>)[`Right.${rightDescField}`] : '';
      newRow[descFieldName] = leftDesc || rightDesc;
  
      // Копируем остальные поля
      Object.entries(row as Record<string, any>).forEach(([key, value]) => {
        if (!key.startsWith('Level') && 
            key !== leftKeyField && 
            key !== rightKeyField && 
            !key.endsWith(leftDescField || '') && 
            !key.endsWith(rightDescField || '')) {
          newRow[key] = value;
        }
      });
      
      // Добавляем сравнительные колонки
      comparePairs.forEach(([leftField, rightField]) => {
        const fieldName = leftField.replace('Left.', '');
        if (fieldName !== leftDescField && fieldName !== rightDescField) {
          newRow[`${fileIds[0]}_${fieldName}`] = (row as Record<string, any>)[leftField];
          newRow[`${fileIds[1]}_${fieldName}`] = (row as Record<string, any>)[rightField];

          if (leftField === columnToProcess || rightField === secondColumnToProcess) {
            const oldValue = (row as Record<string, any>)[leftField];
            const newValue = (row as Record<string, any>)[rightField];

            const oldItems = processRefDesString(oldValue);
            const newItems = processRefDesString(newValue);
            
            const canceled = oldItems.filter(item => !newItems.includes(item));
            const added = newItems.filter(item => !oldItems.includes(item));
            
            newRow[`Canceled_${fieldName}`] = canceled.join(', ');
            newRow[`Added_${fieldName}`] = added.join(', ');
          }
        }
      });
      
      return newRow;
    });
  
    // Формируем заголовки
    const compareHeaders = comparePairs.flatMap(([leftField]) => {
      const fieldName = leftField.replace('Left.', '');
      if (fieldName === leftDescField || fieldName === rightDescField) return [];
      
      const headers = [`${fileIds[0]}_${fieldName}`, `${fileIds[1]}_${fieldName}`];
      
      if (leftField === columnToProcess || leftField === secondColumnToProcess) {
        headers.push(`Canceled_${fieldName}`, `Added_${fieldName}`);
      }
      
      return headers;
    });
    
    // Формируем все заголовки
    const levelHeaders = selectedFieldsOrder.filter(header => header.startsWith('Level'));
    const remainingHeaders = selectedFieldsOrder.filter(header => 
      !header.startsWith('Level') && 
      !header.endsWith(keyFieldName) && 
      !header.endsWith(leftDescField || '') &&
      !header.endsWith(rightDescField || '')
    );
    
    const allHeaders = [
      ...levelHeaders,
      keyFieldName,
      descFieldName,
      ...remainingHeaders,
      ...compareHeaders
    ].filter(header => !header.includes('Left') && !header.includes('Right'));
  
    // Устанавливаем колонки
    worksheet.columns = allHeaders.map(header => ({
      header,
      key: header,
      width: 15
    }));
  
    // НОВЫЙ КОД: Фильтруем данные перед добавлением в таблицу
    const filteredExportData = exportData.filter(row => {
      // Получаем все заголовки из текущей строки
      const rowHeaders = Object.keys(row);
      
      // Находим пары колонок с пользовательскими идентификаторами
      const columnPairs = rowHeaders
        .filter(header => header.startsWith(`${fileIds[0]}_`))
        .map(firstHeader => {
          const baseName = firstHeader.replace(`${fileIds[0]}_`, '');
          const secondHeader = `${fileIds[1]}_${baseName}`;
          return { firstHeader, secondHeader };
        })
        .filter(pair => rowHeaders.includes(pair.secondHeader));

      // Проверяем различия хотя бы в одной паре
      return columnPairs.some(pair => {
        const firstValue = (row[pair.firstHeader] || '').toString().trim();
        const secondValue = (row[pair.secondHeader] || '').toString().trim();
        
        return firstValue !== secondValue && 
               !(firstValue === '' && secondValue === '') && 
               !(firstValue === '--' && secondValue === '--') &&
               !(firstValue === '.' && secondValue === '.');
      });
    });
  
    // Добавляем отфильтрованные данные
    worksheet.addRows(filteredExportData);
  
    // Применяем стили
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

        const startMatch = start.match(/^([A-Za-z_]*)(\d+)$/);
        const endMatch = end.match(/^([A-Za-z_]*)(\d+)$/);

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
    setFieldMappings([]);
    setFileIds({});
    
    // Перезагружаем страницу
    window.location.reload();
  };

  const handleFieldMappingChange = (index: number, field: 'leftField' | 'rightField', value: string) => {
    setFieldMappings((prevMappings) =>
      prevMappings.map((mapping, i) =>
        i === index ? { ...mapping, [field]: value } : mapping
      )
    );
  };

  const removeFieldMapping = (index: number) => {
    setFieldMappings((prevMappings) =>
      prevMappings.filter((_, i) => i !== index)
    );
  };

  const addFieldMapping = () => {
    setFieldMappings((prevMappings) => [...prevMappings, { leftField: '', rightField: '', isActive: true }]);
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
        
        <div style={{ 
          backgroundColor: '#1C2128', 
          padding: '20px', 
          borderRadius: '8px', 
          marginBottom: '20px',
          color: '#E6EDF3',
          width: '100%',
          textAlign: 'left'
        }}>
          <h2 style={{ 
            color: '#7E57C2', 
            marginBottom: '15px', 
            fontSize: '20px' 
          }}>Quick Start Guide:</h2>
          <div style={{ 
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
            alignItems: 'flex-start',
            lineHeight: '1.8',
            fontSize: '16px'
          }}>
            <span>Upload two Excel files you want to compare</span>
            <span>Select sheets from each file</span>
            <span>Check boxes next to columns you want to compare</span>
            <span>Select a key column (like Part Number) in each file to match rows</span>
            <span>If same columns have different names - map them in the section below</span>
            <span>Click "Merge" to see preview, then "Download" for full report</span>
          </div>
        </div>

        <div style={{
          width: '100%',
          backgroundColor: '#1C2128',
          padding: '20px',
          borderRadius: '8px',
          marginBottom: '20px'
        }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '20px'
          }}>
            {[0, 1].map((index) => (
              <div key={index} style={{
                backgroundColor: '#161B22',
                padding: '20px',
                borderRadius: '8px'
              }}>
                <div style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '15px',
                  marginBottom: '20px' 
                }}>
                  <h2 className="text-xl font-semibold" style={{ color: '#E6EDF3' }}>File {index + 1}</h2>
                  <input
                    type="text"
                    placeholder="Enter file identifier (required)"
                    value={fileIds[index] || ''}
                    onChange={(e) => handleFileIdChange(index, e.target.value)}
                    required
                    style={{
                      padding: '8px 12px',
                      backgroundColor: '#1C2128',
                      color: '#E6EDF3',
                      border: '1px solid #7E57C2',
                      borderRadius: '4px',
                      fontSize: '14px',
                      width: '250px'
                    }}
                  />
                </div>
                <label htmlFor={`file-input-${index}`} className="mb-2 block" style={{ color: '#E6EDF3' }}>
                  Choose Excel file:
                </label>
                <div style={{
                  position: 'relative',
                  marginBottom: '20px',
                  width: '520px'
                }}>
                  <Input
                    id={`file-input-${index}`}
                    type="file"
                    accept=".xlsx,.xls"
                    onChange={(e) => handleFileUpload(e, index)}
                    style={{
                      opacity: 0,
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: '100%',
                      height: '100%',
                      cursor: 'pointer',
                      zIndex: 2
                    }}
                  />
                  <div style={{
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
                    zIndex: 1
                  }}>
                    Choose File
                  </div>
                </div>
                {!files[index] && (
                  <p style={{ color: '#E6EDF3', marginBottom: '15px' }}>No file selected</p>
                )}
                {files[index] && (
                  <p style={{ 
                    color: '#7E57C2', 
                    marginBottom: '15px',
                    fontSize: '14px',
                    fontWeight: 'bold'
                  }}>
                    Selected file: {files[index].name}
                  </p>
                )}
                {files[index] && sheets[files[index].name] && (
                  <div className="mb-4">
                    <select
                      value={selectedSheets[files[index].name] || ""}
                      onChange={(e) => handleSheetSelection(files[index].name, e.target.value)}
                      style={{
                        width: "100%",
                        padding: "8px",
                        border: "1px solid #7E57C2",
                        borderRadius: "4px",
                        backgroundColor: "#1C2128",
                        color: "#E6EDF3",
                        fontSize: "14px"
                      }}
                    >
                      <option value="">Select a sheet</option>
                      {sheets[files[index].name].map((sheet, sheetIndex) => (
                        <option key={`${sheet}-${sheetIndex}`} value={sheet}>{sheet}</option>
                      ))}
                    </select>
                  </div>
                )}

                {files[index] && selectedSheets[files[index].name] && fields[files[index].name] && (
                  <>
                    <div style={{ marginBottom: '20px' }}>
                      <h3 style={{ 
                        color: '#E6EDF3',
                        fontSize: '16px',
                        marginBottom: '10px'
                      }}>Select Key Field:</h3>
                      <select
                        value={keyFields[files[index].name] || ""}
                        onChange={(e) => handleKeyFieldSelection(files[index].name, e.target.value)}
                        style={{
                          width: "100%",
                          padding: "8px",
                          border: "1px solid #7E57C2",
                          borderRadius: "4px",
                          backgroundColor: "#1C2128",
                          color: "#E6EDF3",
                          fontSize: "14px"
                        }}
                      >
                        <option value="">Select a key field</option>
                        {fields[files[index].name].map((field) => (
                          <option key={field} value={field}>{field}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <h3 style={{ 
                        color: '#E6EDF3',
                        fontSize: '16px',
                        marginBottom: '10px'
                      }}>Select Fields to Compare:</h3>
                      <div style={{
                        display: 'grid',
                        gap: '8px',
                        maxHeight: '200px',
                        overflowY: 'auto',
                        padding: '5px'
                      }}>
                        {fields[files[index].name].map((field) => (
                          <label
                            key={field}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              color: '#E6EDF3',
                              cursor: 'pointer'
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={selectedFields[files[index].name]?.includes(field) || false}
                              onChange={() => handleFieldSelection(files[index].name, field)}
                              style={{ marginRight: '8px' }}
                            />
                            {field}
                          </label>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
        <div className="field-mapping-container" style={{ 
          backgroundColor: '#161B22',
          padding: '20px',
          borderRadius: '8px',
          marginBottom: '20px',
          width: '100%'
        }}>
          <h3 style={{ 
            color: '#E6EDF3',
            marginBottom: '15px',
            fontSize: '18px',
            fontWeight: 'bold'
          }}>
            For different column names (if needed - optional)
          </h3>
          <div style={{ 
            display: 'grid',
            gridTemplateColumns: '1fr auto 1fr auto',
            gap: '10px',
            alignItems: 'center'
          }}>
            {fieldMappings.map((mapping, index) => (
              <React.Fragment key={index}>
                <select
                  value={mapping.leftField}
                  onChange={(e) => handleFieldMappingChange(index, 'leftField', e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px',
                    backgroundColor: '#1C2128',
                    color: '#E6EDF3',
                    border: '1px solid #7E57C2',
                    borderRadius: '4px'
                  }}
                >
                  <option value="">Select field from File 1</option>
                  {files[0] && fields[files[0].name]?.map((field) => (
                    <option key={field} value={field}>{field}</option>
                  ))}
                </select>
                <span style={{ color: '#7E57C2', padding: '0 10px' }}>→</span>
                <select
                  value={mapping.rightField}
                  onChange={(e) => handleFieldMappingChange(index, 'rightField', e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px',
                    backgroundColor: '#1C2128',
                    color: '#E6EDF3',
                    border: '1px solid #7E57C2',
                    borderRadius: '4px'
                  }}
                >
                  <option value="">Select field from File 2</option>
                  {files[1] && fields[files[1].name]?.map((field) => (
                    <option key={field} value={field}>{field}</option>
                  ))}
                </select>
                <button
                  onClick={() => removeFieldMapping(index)}
                  style={{
                    padding: '8px',
                    backgroundColor: '#4B3B80',
                    color: '#E6EDF3',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer'
                  }}
                >
                  ✕
                </button>
              </React.Fragment>
            ))}
          </div>
          <button
            onClick={addFieldMapping}
            style={{
              marginTop: '10px',
              padding: '8px 16px',
              backgroundColor: '#4B3B80',
              color: '#E6EDF3',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            Add Column Pair
          </button>
        </div>
        <div className="controls-container" style={{
          width: '100%',
          backgroundColor: '#1C2128',
          padding: '20px',
          borderRadius: '8px',
          marginBottom: '20px'
        }}>
          {/* Первый селектор столбца */}
          <div className="range-selector" style={{ marginBottom: '10px' }}>
            <select
              value={columnToProcess}
              onChange={handleColumnToProcessChange}
              style={{
                width: "100%",
                padding: "8px",
                border: "1px solid #7E57C2",
                borderRadius: "4px",
                backgroundColor: "#1C2128",
                color: "#E6EDF3",
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
                border: "1px solid #7E57C2",
                borderRadius: "4px",
                backgroundColor: "#1C2128",
                color: "#E6EDF3",
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
                padding: "10px 20px",
                backgroundColor: "#4B3B80",
                color: "#E6EDF3",
                border: "none",
                borderRadius: "4px",
                cursor: "pointer",
                marginRight: "10px",
                fontSize: "14px",
                fontWeight: "bold"
              }}
            >
              Merge
            </button>
            <button
              onClick={downloadMergedFile}
              disabled={!mergedPreview}
              style={{
                padding: "10px 20px",
                backgroundColor: "#4B3B80",
                color: "#E6EDF3",
                border: "none",
                borderRadius: "4px",
                cursor: "pointer",
                marginRight: "10px",
                fontSize: "14px",
                fontWeight: "bold"
              }}
            >
              Download
            </button>
          </div>
        </div>
      </header>

      {mergedPreview && mergedPreview.length > 0 && (
        <div className="merged-preview" style={{ 
          margin: "20px 0",
          width: '100%',
          backgroundColor: '#1C2128',
          padding: '20px',
          borderRadius: '8px'
        }}>
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

const App: React.FC = () => {
  return (
    <>
      <Navigation />
      <Routes>
        <Route path="/" element={<MainContent />} />
        <Route path="/about" element={<About />} />
      </Routes>
    </>
  );
};

export default App;

